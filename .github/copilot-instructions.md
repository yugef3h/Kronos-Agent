# Copilot 项目规则（等效 Cursor .cursor/rules）
## 项目上下文
- 技术栈：React 18 + TypeScript + Vite
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
- 写单元测试
- 生成 Jest 测试时严格区分 matcher：原始值/枚举/布尔值/精确字符串优先用 `toBe`；数组和对象结构比较用 `toEqual`；只校验部分字段时用 `toMatchObject`
- 生成文档
- 对于一些尝试修复过的代码，应该是逻辑复杂，可以使用中文注释下
- 如果有问题或未理解到位的，或被指出的差异，记录文档 ./docs/Debried_Issues md，方便复盘
- 优先使用已有基础组件，组件和样式大小尽量小和精美，padding 等不要大，上下保持紧凑
- 对于我下的指令、提示词要有辩证批判的思维去理解和执行，不要照单全收，必要时可以提出质疑和建议