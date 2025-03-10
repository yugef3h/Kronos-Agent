// 初始化：npm init -y && npm i express cors
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// 模拟对话存储（生产环境替换为Redis）
const sessions = new Map();

// 生成流式响应（模拟LLM Token输出）
async function* generateStream(prompt, sessionId, lastEventId = 0) {
  const session = sessions.get(sessionId) || { messages: [], lastId: 0 };
  session.messages.push({ role: 'user', content: prompt });
  sessions.set(sessionId, session);

  // 模拟AI回复（按句子拆分，模拟Token流）
  const aiReply = `你好！你刚才问的是："${prompt}"。这是一个流式响应的Demo，支持断线重连和上下文记忆。当前会话ID：${sessionId}。`;
  const tokens = aiReply.split(''); // 模拟Token拆分

  // 断点续传：从lastEventId开始发送
  for (let i = lastEventId; i < tokens.length; i++) {
    const eventId = i + 1;
    // SSE格式：data: {}\nid: {}\n\n
    yield `data: ${JSON.stringify({
      type: 'content',
      content: tokens[i],
      sessionId,
      eventId
    })}\nid: ${eventId}\n\n`;
    await new Promise(resolve => setTimeout(resolve, 50)); // 模拟推理延迟
  }

  // 发送结束标识
  yield `data: ${JSON.stringify({
    type: 'complete',
    sessionId,
    eventId: tokens.length + 1
  })}\nid: ${tokens.length + 1}\n\n`;

  // 更新会话记忆
  session.messages.push({ role: 'assistant', content: aiReply });
  session.lastId = tokens.length + 1;
  sessions.set(sessionId, session);
}

// SSE流式接口（POST支持Header，推荐）
app.post('/api/chat-stream', async (req, res) => {
  const { prompt, sessionId } = req.body;
  const lastEventId = req.headers['last-event-id'] ? parseInt(req.headers['last-event-id']) : 0;

  // 核心响应头（必须）
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲

  // 生成流并响应
  const stream = generateStream(prompt, sessionId || Date.now().toString(), lastEventId);
  for await (const chunk of stream) {
    res.write(chunk);
  }

  res.end();
});

// 获取会话上下文（用于前端渲染历史）
app.get('/api/session/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId) || { messages: [] };
  res.json(session);
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`后端服务运行在：http://localhost:${PORT}`);
});