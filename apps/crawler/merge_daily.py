"""
每日摘要合并 - 将微博帖子 + Gmail 邮件合并为统一时间线。
使用方式:
    python merge_daily.py --weibo data/1727858283_2026-06-13.json --gmail data/gmail_newsletter_2026-06-13.json
    python merge_daily.py --weibo "data/*_2026-06-13.json" --gmail "data/gmail_*_2026-06-13.json"
    python merge_daily.py --dir data/          # 自动发现今天的所有文件
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path


CHINA_TZ = timezone(timedelta(hours=8))
DATA_DIR = Path(__file__).parent / "data"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="合并微博 + Gmail 数据为每日摘要",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--weibo", nargs="*", default=[], help="微博 JSON 文件路径（支持 glob）")
    parser.add_argument("--gmail", nargs="*", default=[], help="Gmail JSON 文件路径（支持 glob）")
    parser.add_argument("--dir", type=str, default=None, help="自动发现目录下今天的文件")
    parser.add_argument("--output", type=str, default=None, help="输出路径（默认 data/daily_{date}.json）")
    parser.add_argument("--text", action="store_true", default=False, help="同时输出纯文本摘要 daily_{date}.txt")
    return parser.parse_args(argv)


# ---------------------------------------------------------------------------
# 数据读取
# ---------------------------------------------------------------------------

def _date_key(item: dict) -> str:
    """取统一的时间字段（微博 created_at 或 邮件 date）。"""
    return item.get("date") or item.get("created_at") or ""


def load_weibo(paths: list[str]) -> list[dict]:
    """加载微博 JSON 文件，标准化为统一条目格式。"""
    entries: list[dict] = []
    for pattern in paths:
        for fp in sorted(Path().glob(pattern) if "*" in pattern or "?" in pattern else [Path(pattern)]):
            if not fp.exists():
                print(f"[跳过] 文件不存在: {fp}")
                continue
            data = json.loads(fp.read_text(encoding="utf-8"))
            for post in data:
                entries.append({
                    "source": "weibo",
                    "id": str(post.get("id", post.get("mid", ""))),
                    "title": "",  # 微博无标题
                    "text": post.get("text", ""),
                    "date": post.get("created_at", ""),
                    "author": f"UID:{post.get('id', '')[:8]}",
                    "url": f"https://m.weibo.cn/detail/{post.get('id', '')}",
                    "meta": {
                        "reposts": post.get("reposts_count", 0),
                        "comments": post.get("comments_count", 0),
                        "likes": post.get("attitudes_count", 0),
                    },
                })
    return entries


def load_gmail(paths: list[str]) -> list[dict]:
    """加载 Gmail JSON 文件，标准化为统一条目格式。"""
    entries: list[dict] = []
    for pattern in paths:
        for fp in sorted(Path().glob(pattern) if "*" in pattern or "?" in pattern else [Path(pattern)]):
            if not fp.exists():
                print(f"[跳过] 文件不存在: {fp}")
                continue
            data = json.loads(fp.read_text(encoding="utf-8"))
            for mail in data:
                entries.append({
                    "source": "gmail",
                    "id": mail.get("message_id", ""),
                    "title": mail.get("subject", ""),
                    "text": mail.get("snippet", ""),  # 正文太长，用 snippet
                    "full_text": mail.get("text", ""),  # 保留全文
                    "date": mail.get("date", ""),
                    "author": mail.get("sender", ""),
                    "url": "",
                    "labels": mail.get("labels", []),
                })
    return entries


# ---------------------------------------------------------------------------
# 合并 & 输出
# ---------------------------------------------------------------------------

def merge(*sources: list[dict]) -> list[dict]:
    """合并并按时间倒序排列。"""
    all_entries: list[dict] = []
    for entries in sources:
        all_entries.extend(entries)
    # 按日期倒序（最新的在前）
    all_entries.sort(key=lambda e: _date_key(e), reverse=True)
    return all_entries


def render_text(entries: list[dict]) -> str:
    """渲染为可读的纯文本摘要。"""
    lines: list[str] = []
    today = datetime.now(CHINA_TZ).strftime("%Y-%m-%d")
    lines.append(f"Kronos 每日摘要 — {today}")
    lines.append("=" * 50)

    # 按来源分组统计
    weibo_count = sum(1 for e in entries if e["source"] == "weibo")
    gmail_count = sum(1 for e in entries if e["source"] == "gmail")
    lines.append(f"微博 {weibo_count} 条 | 邮件 {gmail_count} 封")
    lines.append("")

    for e in entries:
        tag = "📧" if e["source"] == "gmail" else "🔵"
        title = e.get("title") or e["text"][:60]
        date = _date_key(e)[:16].replace("T", " ")
        lines.append(f"{tag} [{date}] {title}")
        if e["source"] == "gmail":
            lines.append(f"   发件人: {e['author']}")
        if e.get("url"):
            lines.append(f"   {e['url']}")
        lines.append("")

    return "\n".join(lines)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)

    weibo_files: list[str] = list(args.weibo) if args.weibo else []
    gmail_files: list[str] = list(args.gmail) if args.gmail else []

    # --dir 自动发现今天文件
    if args.dir:
        today = datetime.now(CHINA_TZ).strftime("%Y-%m-%d")
        base = Path(args.dir)
        weibo_files.extend(str(p) for p in base.glob(f"*_{today}.json") if "gmail_" not in p.name)
        gmail_files.extend(str(p) for p in base.glob(f"gmail_*_{today}.json"))

    if not weibo_files and not gmail_files:
        print("未指定输入文件。请用 --weibo / --gmail 或 --dir")
        sys.exit(1)

    weibo_entries = load_weibo(weibo_files) if weibo_files else []
    gmail_entries = load_gmail(gmail_files) if gmail_files else []

    merged = merge(weibo_entries, gmail_entries)

    if not merged:
        print("无数据可合并。")
        return

    # JSON 输出
    today = datetime.now(CHINA_TZ).strftime("%Y-%m-%d")
    out_json = Path(args.output) if args.output else DATA_DIR / f"daily_{today}.json"
    DATA_DIR.mkdir(exist_ok=True)
    out_json.write_text(json.dumps(merged, ensure_ascii=False, indent=2))
    print(f"JSON 摘要已保存: {out_json} ({len(merged)} 条)")

    # 纯文本输出
    if args.text:
        out_txt = out_json.with_suffix(".txt")
        out_txt.write_text(render_text(merged), encoding="utf-8")
        print(f"文本摘要已保存: {out_txt}")


if __name__ == "__main__":
    main()
