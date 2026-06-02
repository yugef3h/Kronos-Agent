"""
微博帖子爬虫 - 抓取指定用户公开帖子（文本 + 发布时间）。
使用方式:
    python crawler.py --uid 1727858283 --pages 5
    python crawler.py --uid 1727858283 --since 2025-01-01
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from playwright.async_api import async_playwright, BrowserContext, Page


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """解析命令行参数。"""
    parser = argparse.ArgumentParser(
        description="微博帖子爬虫",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
    python crawler.py --uid 1727858283 --pages 5
    python crawler.py --uid 1727858283 --since 2025-01-01
    python crawler.py --uid 1727858283 --pages 3 --headless
        """,
    )
    parser.add_argument("--uid", required=True, help="微博用户 UID")
    parser.add_argument(
        "--pages",
        type=int,
        default=None,
        help="爬取页数（每页约 10 条，与 --since 互斥）",
    )
    parser.add_argument(
        "--since",
        type=str,
        default=None,
        help="起始日期 YYYY-MM-DD，爬取该日期之后的帖子（与 --pages 互斥）",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        default=False,
        help="无头模式（首次使用建议不加此参数，以便手动登录）",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="输出文件路径（默认 data/{uid}_{date}.json）",
    )

    args = parser.parse_args(argv)

    if args.pages is not None and args.since is not None:
        parser.error("--pages 和 --since 不能同时使用")

    if args.pages is None and args.since is None:
        args.pages = 1  # 默认爬 1 页

    return args


# ---------------------------------------------------------------------------
# 浏览器
# ---------------------------------------------------------------------------

PROFILE_DIR = Path(__file__).parent / ".browser_profile"


async def init_browser(headless: bool = False) -> BrowserContext:
    """启动持久化浏览器上下文，自动复用已保存的 cookie。"""
    PROFILE_DIR.mkdir(exist_ok=True)

    playwright = await async_playwright().start()
    context = await playwright.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR),
        headless=headless,
        viewport={"width": 430, "height": 932},
        user_agent=(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 "
            "Mobile/15E148 Safari/604.1"
        ),
    )
    return context


# ---------------------------------------------------------------------------
# 抓取
# ---------------------------------------------------------------------------

CHINA_TZ = timezone(timedelta(hours=8))


async def fetch_page(page: Page, uid: str, page_num: int) -> list[dict]:
    """抓取单页帖子列表。
    API: m.weibo.cn /api/container/getIndex
    """
    result = await page.evaluate(
        """
        async ([uid, page]) => {
            const url = 'https://m.weibo.cn/api/container/getIndex?type=uid&value=' + uid +
                '&containerid=107603' + uid + '&page=' + page;
            const resp = await fetch(url, {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });
            return await resp.json();
        }
        """,
        [uid, page_num],
    )

    data = result.get("data", {})
    cards = data.get("cards", []) if isinstance(data, dict) else []

    posts: list[dict] = []
    for card in cards:
        mblog = card.get("mblog")
        if mblog is None:
            continue
        posts.append(
            {
                "id": mblog.get("id", ""),
                "mid": mblog.get("mid", ""),
                "text": _clean_text(mblog.get("text", "")),
                "created_at": _parse_time(mblog.get("created_at", "")),
                "source": mblog.get("source", ""),
                "reposts_count": mblog.get("reposts_count", 0),
                "comments_count": mblog.get("comments_count", 0),
                "attitudes_count": mblog.get("attitudes_count", 0),
            }
        )

    return posts


def _clean_text(raw: str) -> str:
    """去除 HTML 标签和多余空白。"""
    text = re.sub(r"<[^>]+>", "", raw)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _parse_time(raw: str) -> str:
    """解析微博时间格式为 ISO-8601。"""
    if not raw:
        return ""
    for fmt in (
        "%a %b %d %H:%M:%S %z %Y",   # Tue Jun 02 14:27:10 +0800 2026
        "%a %b %d %H:%M:%S %Y",       # fallback: no timezone
    ):
        try:
            dt = datetime.strptime(raw, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=CHINA_TZ)
            return dt.astimezone(CHINA_TZ).isoformat(timespec="seconds")
        except ValueError:
            continue
    return raw  # 解析失败原样返回


# ---------------------------------------------------------------------------
# 主爬取循环
# ---------------------------------------------------------------------------

async def crawl(
    context: BrowserContext,
    uid: str,
    *,
    max_pages: int | None = None,
    since: str | None = None,
) -> list[dict]:
    """爬取微博用户帖子，返回帖子列表。

    参数:
        context: Playwright 浏览器上下文。
        uid: 微博用户 UID。
        max_pages: 最大爬取页数（与 since 二选一）。
        since: 起始日期 ISO 字符串，只保留此日期之后的帖子。

    返回:
        帖子列表，按时间倒序。
    """
    page = await context.new_page()
    all_posts: list[dict] = []

    since_dt: datetime | None = None
    if since:
        since_dt = datetime.strptime(since, "%Y-%m-%d").replace(tzinfo=CHINA_TZ)
        max_pages = max_pages or 100  # since 模式下安全上限

    page_num = 1
    while True:
        if max_pages is not None and page_num > max_pages:
            break

        print(f"抓取第 {page_num} 页 ...", end=" ")

        try:
            posts = await fetch_page(page, uid, page_num)
        except Exception as exc:
            print(f"失败: {exc}")
            break

        if not posts:
            print("无帖子，结束")
            break

        print(f"{len(posts)} 条")

        for post in posts:
            # 时间过滤
            if since_dt:
                post_dt = datetime.fromisoformat(post["created_at"])
                if post_dt < since_dt:
                    # 帖子已早于 since，结束全部爬取
                    await page.close()
                    return all_posts
            all_posts.append(post)

        page_num += 1
        await asyncio.sleep(1.5)  # 请求间隔防封

    await page.close()
    return all_posts


# ---------------------------------------------------------------------------
# 持久化
# ---------------------------------------------------------------------------

DATA_DIR = Path(__file__).parent / "data"


def save(posts: list[dict], uid: str, output_path: str | None = None) -> Path:
    """将帖子列表保存为 JSON 文件。"""
    DATA_DIR.mkdir(exist_ok=True)

    if output_path:
        path = Path(output_path)
    else:
        today = datetime.now(CHINA_TZ).strftime("%Y-%m-%d")
        path = DATA_DIR / f"{uid}_{today}.json"

    path.write_text(json.dumps(posts, ensure_ascii=False, indent=2))
    return path


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------

async def main(argv: list[str] | None = None) -> None:
    """命令行入口。"""
    args = parse_args(argv)

    context = await init_browser(headless=args.headless)

    posts = await crawl(
        context,
        args.uid,
        max_pages=args.pages,
        since=args.since,
    )

    path = save(posts, args.uid, args.output)
    print(f"\n共 {len(posts)} 条帖子，已保存到 {path}")

    # 关闭浏览器
    await context.close()


if __name__ == "__main__":
    asyncio.run(main())
