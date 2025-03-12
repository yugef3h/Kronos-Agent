# Copilot 项目规则（等效 Cursor .cursor/rules）
## 项目上下文
- 技术栈：React 18 + TypeScript + Vite + Go 后端
- 构建工具：Vite 5.x，目标 ES2020
- 代码规范：遵循 Airbnb React/TS 规范，使用 Prettier + ESLint
- 安全要求：禁止硬编码密钥，API 必须带 JWT 验证，客户端不存敏感信息

## 编码规则
### 命名规范
- 组件/接口/类型：PascalCase；变量/函数：camelCase；常量：ALL_CAPS
- 布尔值：is/has/can 前缀；函数名：动词/动词短语（如 `getUserInfo`）

### 代码风格
- 用 ES6+ 特性（箭头函数、模板字面量、解构），避免 var
- 组件必须写 Props 类型，私有成员加下划线前缀（如 `_handleClick`）
- 复杂逻辑加注释，API 调用必须加错误处理

### AI 行为
- 生成代码时优先复用现有组件/工具函数，不重复造轮子
- 生成代码后附带单元测试（Jest）和关键注释
- 拒绝生成不安全代码（如 SQL 注入、XSS、硬编码密钥）