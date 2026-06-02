# 微博爬虫

基于 Playwright 的微博帖子爬虫，抓取指定用户公开帖子的文本和发布时间。

## 安装

```bash
pnpm install:crawler
```

## 使用

```bash
# 爬最近 3 页（每页约 10 条）
pnpm crawl -- --uid 1727858283 --pages 3

# 爬指定日期之后的帖子
pnpm crawl -- --uid 1727858283 --since 2025-06-01

# 换账号
pnpm crawl -- --uid 其他UID --pages 5

# 显示浏览器窗口（用于首次登录）
pnpm crawl -- --uid 1727858283 --pages 3 --show
```

结果保存在 `data/{uid}_{日期}.json`。

## 输出格式

```json
[
  {
    "id": "5246969136287056",
    "mid": "5246969136287056",
    "text": "整理个置顶贴...",
    "created_at": "2025-12-23T10:53:09+08:00",
    "source": "微博 weibo.com",
    "reposts_count": 1738,
    "comments_count": 196,
    "attitudes_count": 1864
  }
]
```

## 首次使用

首次运行时加 `--show` 打开浏览器窗口。如果账号需要登录，在浏览器中扫码登录后 cookie 自动保存，后续无需 `--show`。

## 如何获取 UID

打开微博用户主页，URL 中的数字即为 UID：
```
https://weibo.com/u/1727858283  →  UID: 1727858283
```
