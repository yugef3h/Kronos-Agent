# Multi Agent 实现方案（对应Cherry Studio效果）

## Q: Cherry Studio中创建多个小Agent，给每个Agent设定人设（如“谷歌DeepMind研发总负责人”），并录入公司产品、项目等相关上下文，使其能站在对应角色角度分析问题，提供意想不到的想法。如果是我自己开发应用，怎么实现？

## A: 可直接落地、前端+后端全解析方案

以下是一套完全对应Cherry Studio效果的实现方案，涵盖「多Agent + 固定人设 + 私有知识库/上下文 + 角色视角输出」，以工程化视角讲解，适配10年前端经验，不绕弯、可直接参考落地。

## 一、核心功能明确

每个Agent的核心构成（缺一不可）：

1. **固定人设prompt**：明确Agent的身份、性格、说话风格，划定角色边界；

2. **私有知识库**：存储公司产品、项目、技术路线、核心数据等专属上下文；

3. **独立记忆/对话历史**：保留与该Agent的交互记录，保证对话连贯性；

4. **统一调度入口**：支持单个Agent独立响应，也可实现多Agent讨论、互评、协作。

**最终效果**：用户提问 → 系统将问题分发至对应角色Agent → Agent结合自身人设+私有知识库输出回答 → 呈现具有明确立场、专属视角、超出预期的创新观点。

## 二、最简技术栈（最快上线，适配前端）

优先选择低代码/轻量后端，无需从头开发大模型，聚焦Agent逻辑实现，前端可快速上手。

### （一）前端

- 框架：React / Vue / 小程序均可（按需选择熟悉的技术栈）；

- 核心界面：角色列表（展示所有Agent） + 聊天交互框 + 知识库上传/编辑面板。

### （二）后端（二选一，按需选择）

1. **最快落地（适合Demo）**：直接通过前端调用大模型API，无需搭建后端服务；

2. **正式部署（适合生产）**：用Node.js / Python FastAPI搭建一层代理，统一管理API调用、权限控制和数据存储。

### （三）大模型（核心依赖）

- 云端API：OpenAI GPT-3.5/4o、通义千问、文心一言、Doubao、Claude等；

- 本地部署：Ollama（支持Llama 3、Qwen、GLM等模型，无需联网）。

### （四）知识库（分版本，逐步升级）

1. **简单版**：用JSON / 文本文件存储，适合少量产品、项目信息；

2. **进阶版**：用向量数据库（Chroma、Pinecone、Qdrant）实现RAG检索，适配大量内部资料。

## 三、核心实现逻辑（最关键，直接决定Agent效果）

### （一）每个Agent的结构设计（JS示例）

```javascript
const agentList = [
  {
    id: "deepmind-head",
    name: "谷歌DeepMind研发总负责人",
    systemPrompt: `
你是DeepMind研发总负责人，风格严谨、前瞻、喜欢从第一性原理思考。
说话简洁犀利，擅长指出技术盲点。
`,
    // 私有上下文/知识库（专属该角色的产品、项目信息）
    knowledge: `
产品：Gemini、AlphaFold、AlphaGo、Gemma
项目方向：通用人工智能、具身智能、AI for Science
技术路线：大模型+强化学习、多模态、安全对齐
`,
    // 风格控制（影响回答创新性）
    temperature: 0.9,
    topP: 0.95
  },
  {
    id: "product-director",
    name: "产品负责人",
    systemPrompt: "你是商业化产品负责人，风格务实，擅长从用户痛点和商业化角度分析问题，说话接地气，聚焦落地性。",
    knowledge: "产品roadmap、用户核心痛点、商业化变现路径、竞品分析、迭代优先级"
  }
];
```

### （二）提问时的Prompt拼接逻辑（核心步骤）

给大模型的完整输入的固定结构，直接决定Agent是否能“代入角色”：

```text
[系统人设]
[私有知识库]
[历史对话]
用户问题：{question}
```

示例（对应DeepMind研发总负责人角色）：

```text
你是DeepMind研发总负责人，风格犀利、前瞻。

以下是你负责的产品与项目：
Gemini、AlphaFold、强化学习对齐、具身智能研发、AI for Science相关项目。

用户现在问：如何看待下一代AGI架构？
```

按此结构拼接，大模型会自动站在该角色角度，结合专属知识库输出回答，避免大众化表述。

### （三）实现“意想不到的想法”（关键优化）

通过2个参数+1句指令，引导Agent输出创新、反常识观点，避免同质化：

1. 参数控制：`temperature = 0.7 ~ 1.0`（数值越高，回答越具创新性、随机性）；`topP = 0.9 ~ 1`（控制回答的多样性，避免局限于常规表述）；

2. 指令引导：在Prompt末尾添加一句固定要求 → 「请给出反常识、非常规、业内少有人提的观点，不要大众化答案，结合自身角色视角，突出专业度」。

# 四、完整应用架构（适合正式开发）

### （一）前端结构（核心模块）

1. **角色管理面板**：支持Agent的增删改查，可编辑人设prompt、上传/粘贴/修改私有知识库，调整风格参数（temperature、topP）；

2. **聊天界面**：支持选择单个Agent、发送问题、展示Agent回答，保留对话历史，支持清空/导出记录；

3. **可选进阶模块：多角色圆桌讨论**：一个问题同时分发给多个Agent，支持Agent之间互相评论、辩论，形成多元观点碰撞。

### （二）后端接口设计（Node.js示例）

核心接口（聊天交互）：

```json
POST /api/chat
{
  "agentId": "deepmind-head",
  "message": "如何设计下一代大模型架构？"
}
```

后端核心处理流程（3步完成）：

1. 根据请求中的agentId，查询该Agent的人设prompt、私有知识库、风格参数；

2. 按照固定结构，拼接人设、知识库、历史对话和用户问题，生成完整Prompt；

3. 调用大模型API（流式/非流式），获取回答结果，返回给前端。

### （三）知识库进阶：RAG实现（精准引用内部资料）

当知识库内容较多（如大量产品文档、项目资料），无法全部塞进Prompt时，用RAG检索优化，避免Agent瞎编信息：

1. 预处理：将产品文档、项目资料、内部数据等，切割成固定长度的文本片段（chunk）；

2. 向量存储：将所有文本片段转成向量，存入向量数据库（Chroma/Pinecone等）；

3. 检索匹配：用户提问后，将问题转成向量，在向量库中检索最相关的3~5条文本片段；

4. Prompt拼接：将检索到的相关片段，融入Agent的人设和用户问题，拼接成完整Prompt，确保Agent能精准引用内部信息。

## 五、最小可运行Demo（当天可写出，前端伪代码）

以React为例，实现单个Agent的聊天交互，无需后端，直接调用OpenAI API：

```javascript
async function sendToAgent(agentId, question) {
  // 1. 根据agentId获取对应Agent信息
  const agent = agentList.find(a => a.id === agentId);

  // 2. 拼接完整Prompt（人设+知识库+问题+创新要求）
  const prompt = `${agent.systemPrompt}

内部资料：
${agent.knowledge}

用户问题：${question}
请以该角色身份给出犀利、反常识的创新观点，不要大众化答案，突出专业视角。`;

  // 3. 调用OpenAI API，获取回答
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer sk-xxx" // 替换成自己的API Key
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: agent.temperature // 复用Agent的风格参数
    })
  });

  // 4. 解析结果，返回给前端展示
  const data = await res.json();
  return data.choices[0].message.content;
}
```

说明：以上就是Cherry Studio多Agent功能的核心原理，简化后可快速实现Demo，验证效果。

## 六、进阶功能：多Agent协作（辩论/头脑风暴）

实现“会议模式”，让多个Agent协作产出更具创新性的组合观点，步骤如下：

1. 用户提出一个核心问题（如“下一代大模型的商业化路径”）；

2. 系统将问题同步分发给所有Agent（研发负责人、产品负责人、市场负责人等）；

3. 每个Agent独立思考，输出自己的观点（基于自身人设和知识库）；

4. 创建一个“主持人Agent”，汇总所有Agent的观点，梳理冲突点和亮点；

5. （可选）让Agent之间互相追问、反驳，深化观点，最终形成全面、多元的结论。

## 七、可落地的完整代码支持

若需开发完整应用，提供以下4个信息，可直接获取「可运行项目结构 + 完整代码」，适配前端工程师开发习惯：

1. 前端框架：React/Vue/原生？

2. 部署方式：云端部署（调用在线大模型API）还是本地部署（Ollama）？

3. 知识库需求：纯文本录入，还是需要支持PDF/Word上传解析？

4. 交互效果：是否需要流式打字效果（提升用户体验）？

完整代码将包含：角色配置系统、聊天界面、人设+知识库管理、大模型API接入、多Agent讨论功能，可直接运行、按需修改。

推荐：可先获取React + Node.js完整可跑模板，快速上手验证效果，再逐步迭代优化。
> （注：文档部分内容可能由 AI 生成）