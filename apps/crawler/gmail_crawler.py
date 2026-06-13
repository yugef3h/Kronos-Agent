"""
Gmail 邮件爬虫 - 通过 IMAP 抓取指定发件人的邮件内容。
使用方式:
    python gmail_crawler.py --from "newsletter@example.com" --days 7
    python gmail_crawler.py --from "ai-news@substack.com" --since 2026-06-01 --show

首次使用前:
    1. 确保 Google 账号已开启两步验证
    2. 前往 https://myaccount.google.com/apppasswords 生成应用专用密码
       - 选择应用: "邮件"
       - 选择设备: "其他 (Kronos Crawler)"
    3. 将生成的 16 位密码填入 apps/.env:
       GMAIL_USER=yourname@gmail.com
       GMAIL_APP_PASSWORD=xxxxyyyyzzzzwwww
"""

from __future__ import annotations

import argparse
import email
import email.message
import email.policy
import imaplib
import json
import os
import re
import ssl
import sys
import textwrap
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path


# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------

CHINA_TZ = timezone(timedelta(hours=8))
DATA_DIR = Path(__file__).parent / "data"

# 从 .env 读取凭据（优先根目录，兼容 apps/.env）
_ENV_PATHS = [
    Path(__file__).parent.parent.parent / ".env",   # 根目录 .env
    Path(__file__).parent.parent / ".env",           # apps/.env
]


def _load_dotenv(path: Path) -> dict[str, str]:
    """极简 .env 解析，不依赖第三方库。"""
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        env[key] = value
    return env


# ---------------------------------------------------------------------------
# HTML 剥离
# ---------------------------------------------------------------------------

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")
_ENTITY_RE = re.compile(r"&[a-z]+;|&#\d+;")

# 常见 HTML 实体
_ENTITIES = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
    "&apos;": "'", "&nbsp;": " ", "&#39;": "'",
}


def strip_html(html: str) -> str:
    """去除 HTML 标签和实体，返回纯文本。"""
    text = _TAG_RE.sub(" ", html)
    for entity, char in _ENTITIES.items():
        text = text.replace(entity, char)
    text = _ENTITY_RE.sub(" ", text)
    text = _WS_RE.sub(" ", text)
    return text.strip()


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------

@dataclass
class EmailItem:
    """单封邮件。"""
    message_id: str
    subject: str
    sender: str
    date: str           # ISO-8601
    text: str           # 纯文本正文
    snippet: str        # 前 200 字摘要
    labels: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Gmail 邮件爬虫 (IMAP)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            示例:
                python gmail_crawler.py --from "newsletter@example.com" --days 7
                python gmail_crawler.py --from "ai-news@substack.com" --since 2026-06-01
                python gmail_crawler.py --from "thebatch@deeplearning.ai" --days 3 --show
        """),
    )
    parser.add_argument(
        "--from", dest="sender",
        default="news@daily.therundown.ai",
        help="发件人邮箱或关键词（默认 news@daily.therundown.ai）",
    )
    parser.add_argument(
        "--days", type=int, default=7,
        help="抓取最近 N 天的邮件（默认 7）",
    )
    parser.add_argument(
        "--since", type=str, default=None,
        help="起始日期 YYYY-MM-DD（与 --days 同时指定时，取更宽的范围）",
    )
    parser.add_argument(
        "--max", dest="max_emails", type=int, default=20,
        help="最多抓取封数（默认 20）",
    )
    parser.add_argument(
        "--show", action="store_true", default=False,
        help="打印邮件正文到终端",
    )
    parser.add_argument(
        "--output", type=str, default=None,
        help="输出文件路径（默认 data/gmail_{date}.json）",
    )
    parser.add_argument(
        "--mailbox", type=str, default="INBOX",
        help="抓取的邮箱文件夹（默认 INBOX）",
    )
    return parser.parse_args(argv)


# ---------------------------------------------------------------------------
# IMAP 连接
# ---------------------------------------------------------------------------

def connect_imap(email_addr: str, app_password: str) -> imaplib.IMAP4_SSL:
    """建立 Gmail IMAP SSL 连接并登录。"""
    ctx = ssl.create_default_context()
    conn = imaplib.IMAP4_SSL("imap.gmail.com", 993, ssl_context=ctx)
    conn.login(email_addr, app_password)
    return conn


# ---------------------------------------------------------------------------
# 邮件抓取
# ---------------------------------------------------------------------------

def _decode_header(value: str | None) -> str:
    """解码 RFC 2047 编码的邮件头（如 =?UTF-8?B?...?=）。"""
    if not value:
        return ""
    parts: list[str] = []
    for text, charset in email.header.decode_header(value):
        if isinstance(text, bytes):
            try:
                parts.append(text.decode(charset or "utf-8", errors="replace"))
            except (LookupError, UnicodeDecodeError):
                parts.append(text.decode("utf-8", errors="replace"))
        else:
            parts.append(str(text))
    return "".join(parts)


def _extract_text(msg: email.message.EmailMessage | email.message.Message) -> str:
    """从 MIME 消息中提取纯文本正文。优先 text/plain，否则从 text/html 剥离。"""
    if msg.is_multipart():
        parts_text: list[str] = []
        parts_html: list[str] = []
        for part in msg.walk():
            content_type = part.get_content_type()
            if part.get_content_disposition() == "attachment":
                continue
            payload = part.get_payload(decode=True)
            if payload is None:
                continue
            charset = part.get_content_charset() or "utf-8"
            try:
                decoded = payload.decode(charset, errors="replace")
            except (LookupError, UnicodeDecodeError):
                decoded = payload.decode("utf-8", errors="replace")
            if content_type == "text/plain":
                parts_text.append(decoded)
            elif content_type == "text/html":
                parts_html.append(decoded)
        # 优先纯文本，否则从 HTML 剥离
        if parts_text:
            return "\n\n".join(parts_text)
        if parts_html:
            return strip_html("\n".join(parts_html))
        return ""
    else:
        payload = msg.get_payload(decode=True)
        if payload is None:
            return ""
        content_type = msg.get_content_type()
        charset = msg.get_content_charset() or "utf-8"
        try:
            decoded = payload.decode(charset, errors="replace")
        except (LookupError, UnicodeDecodeError):
            decoded = payload.decode("utf-8", errors="replace")
        if content_type == "text/html":
            return strip_html(decoded)
        return decoded


def _parse_date(msg: email.message.EmailMessage | email.message.Message) -> str:
    """从邮件 Date 头解析为 ISO-8601 字符串。"""
    raw = msg.get("Date", "")
    if not raw:
        return ""
    try:
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(CHINA_TZ).isoformat(timespec="seconds")
    except Exception:
        return raw


def fetch_emails(
    conn: imaplib.IMAP4_SSL,
    sender: str,
    *,
    since: datetime | None = None,
    max_emails: int = 20,
    mailbox: str = "INBOX",
) -> list[EmailItem]:
    """搜索并抓取邮件。"""
    # 选择邮箱
    status, _ = conn.select(mailbox, readonly=True)
    if status != "OK":
        print(f"无法打开邮箱: {mailbox}")
        return []

    # 构建搜索条件: FROM + SINCE
    criteria = [f'FROM "{sender}"']
    if since:
        criteria.append(f"SINCE {since.strftime('%d-%b-%Y')}")
    search_criteria = " ".join(criteria)

    print(f"搜索: {search_criteria}")
    status, data = conn.search(None, search_criteria)
    if status != "OK":
        print("搜索失败")
        return []

    all_ids = data[0].split()
    if not all_ids:
        print("未找到匹配邮件")
        return []

    # 取最近的 max_emails 封
    ids_to_fetch = all_ids[-max_emails:]  # IMAP 返回的 ID 按时间递增
    print(f"找到 {len(all_ids)} 封，抓取最近 {len(ids_to_fetch)} 封")

    emails: list[EmailItem] = []
    for msg_id in reversed(ids_to_fetch):  # 最新的在前
        status, msg_data = conn.fetch(msg_id, "(RFC822)")
        if status != "OK":
            continue

        raw_bytes = msg_data[0][1]  # type: ignore[index]
        if raw_bytes is None:
            continue

        msg = email.message_from_bytes(raw_bytes, policy=email.policy.default)
        text = _extract_text(msg)
        subject = _decode_header(msg.get("Subject", ""))
        sender_raw = _decode_header(msg.get("From", ""))
        date_str = _parse_date(msg)
        msg_id_str = _decode_header(msg.get("Message-ID", "")).strip("<>")

        # Gmail 标签（X-GM-LABELS）
        labels_str = _decode_header(msg.get("X-GM-LABELS", ""))
        labels = [lbl.strip('"') for lbl in labels_str.split()] if labels_str else []

        snippet = text[:200].replace("\n", " ")

        emails.append(EmailItem(
            message_id=msg_id_str,
            subject=subject,
            sender=sender_raw,
            date=date_str,
            text=text,
            snippet=snippet,
            labels=labels,
        ))

    return emails


# ---------------------------------------------------------------------------
# 持久化
# ---------------------------------------------------------------------------

def save(emails: list[EmailItem], sender: str, output_path: str | None = None) -> Path:
    """将邮件列表保存为 JSON。"""
    DATA_DIR.mkdir(exist_ok=True)

    if output_path:
        path = Path(output_path)
    else:
        # 用发件人用户名部分做文件名
        sender_key = re.sub(r"[^a-zA-Z0-9_.-]", "_", sender.split("@")[0])
        today = datetime.now(CHINA_TZ).strftime("%Y-%m-%d")
        path = DATA_DIR / f"gmail_{sender_key}_{today}.json"

    data = [asdict(e) for e in emails]
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    return path


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)

    # 读取凭据（合并多个 .env）
    env: dict[str, str] = {}
    for p in _ENV_PATHS:
        env.update(_load_dotenv(p))
    email_addr = os.getenv("GMAIL_USER", env.get("GMAIL_USER", ""))
    app_password = os.getenv("GMAIL_APP_PASSWORD", env.get("GMAIL_APP_PASSWORD", ""))

    if not email_addr or not app_password:
        print("错误: 请在 apps/.env 中设置 GMAIL_USER 和 GMAIL_APP_PASSWORD")
        print()
        print("获取应用专用密码:")
        print("  1. 前往 https://myaccount.google.com/apppasswords")
        print('  2. 选择应用: "邮件", 设备: "其他 (Kronos Crawler)"')
        print("  3. 将生成的 16 位密码填入 apps/.env")
        sys.exit(1)

    # 计算时间范围
    since_dt: datetime | None = None
    if args.since:
        since_dt = datetime.strptime(args.since, "%Y-%m-%d").replace(tzinfo=CHINA_TZ)
    if args.days > 0:
        days_ago = datetime.now(CHINA_TZ) - timedelta(days=args.days)
        if since_dt is None or days_ago < since_dt:
            since_dt = days_ago

    print(f"连接 Gmail ({email_addr}) ...")
    conn = connect_imap(email_addr, app_password)

    try:
        emails = fetch_emails(
            conn,
            args.sender,
            since=since_dt,
            max_emails=args.max_emails,
            mailbox=args.mailbox,
        )
    finally:
        conn.logout()

    if not emails:
        print("未抓到邮件。")
        return

    path = save(emails, args.sender, args.output)
    print(f"\n共 {len(emails)} 封邮件，已保存到 {path}")

    if args.show:
        for e in emails:
            print(f"\n{'─'*60}")
            print(f"[{e.date}] {e.subject}")
            print(f"发件人: {e.sender}")
            print(f"{'─'*60}")
            print(e.text[:500])


if __name__ == "__main__":
    main()
