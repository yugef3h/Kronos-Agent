"""
微博帖子爬虫 - 抓取指定用户公开帖子（文本 + 发布时间）。
使用方式:
    python crawler.py --uid 1727858283 --pages 5
    python crawler.py --uid 1727858283 --since 2025-01-01
"""

from __future__ import annotations

import argparse
import sys


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
