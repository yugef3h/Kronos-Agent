# Dev JWT 自动签发说明

## 背景

为保证安全，`JWT_SECRET` 只能保存在服务端，不应暴露给前端。

为了让本地联调更高效，项目提供了一个仅开发环境可用的测试 token 签发接口，前端页面会自动拉取并填充 JWT 输入框。

## 行为说明

- 接口: `GET /api/dev/token`
- 仅在 `NODE_ENV !== production` 时可用
- 在 `production` 环境返回 `404`
- 返回结构:

```json
{
  "token": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": "7d"
}
```

## 前端使用流程

1. 页面加载时，如果 JWT 输入框为空，会自动调用 `GET /api/dev/token`。
2. 请求成功后，自动把 `token` 写入输入框。
3. 你也可以手动点击“生成测试 JWT”按钮重新签发。

## 安全边界

- 该能力仅用于本地/测试联调。
- 生产环境必须关闭自动签发入口（当前实现已默认关闭）。
- 前端不持有 `JWT_SECRET`，只持有短期可用的签发结果。
