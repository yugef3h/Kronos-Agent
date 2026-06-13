# 微博 & Gmail 爬虫

抓取微博用户公开帖子和 Gmail 邮件，合并为每日摘要。

## 安装

```bash
pnpm install:crawler
```

## 微博爬虫

```bash
# 爬最近 3 页（每页约 10 条）
pnpm crawl -- --uid 1727858283 --pages 3

# 爬指定日期之后
pnpm crawl -- --uid 1727858283 --since 2025-06-01

# 首次使用加 --show 扫码登录
pnpm crawl -- --uid 1727858283 --pages 3 --show
```

## Gmail 爬虫

### 一次性配置

1. 确保 Google 账号已开启两步验证
2. 前往 https://myaccount.google.com/apppasswords 生成应用专用密码
   - 选择应用: **邮件**
   - 选择设备: **其他 (Kronos Crawler)**
3. 在 `.env` 中添加：
   ```
   GMAIL_USER=yourname@gmail.com
   GMAIL_APP_PASSWORD=你的16位密码
   ```

### 使用

```bash
# 抓取最近 7 天的 AI 快讯邮件
python gmail_crawler.py --from "newsletter@deeplearning.ai" --days 7

# 抓取指定日期之后，最多 10 封
python gmail_crawler.py --from "ai-news@substack.com" --since 2026-06-01 --max 10

# 打印正文到终端预览
python gmail_crawler.py --from "thebatch@deeplearning.ai" --days 3 --show
```

结果保存在 `data/gmail_{sender}_{日期}.json`。

## 每日合并

```bash
# 合并今天的微博 + Gmail 数据
python merge_daily.py --weibo data/1727858283_2026-06-13.json --gmail data/gmail_newsletter_2026-06-13.json

# 自动发现 data/ 目录下今天的所有文件
python merge_daily.py --dir data/

# 同时输出可读文本摘要
python merge_daily.py --dir data/ --text
```

输出: `data/daily_{日期}.json` (及可选的 `.txt`)

## 输出格式

微博：
```json
[{
  "id": "5246969136287056",
  "text": "整理个置顶贴...",
  "created_at": "2025-12-23T10:53:09+08:00",
  "reposts_count": 1738, "comments_count": 196, "attitudes_count": 1864
}]
```

Gmail:
```json
[{
  "message_id": "<abc123@mail.gmail.com>",
  "subject": "The Batch - AI News Weekly",
  "sender": "The Batch <thebatch@deeplearning.ai>",
  "date": "2026-06-13T08:30:00+08:00",
  "text": "本周 AI 要闻...",
  "snippet": "本周 AI 要闻...",
  "labels": ["INBOX", "IMPORTANT"]
}]
```
