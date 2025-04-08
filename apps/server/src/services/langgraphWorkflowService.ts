import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import type { LangChainStreamEvent } from './langchainChatService.js';
import { chatModel, toolRegistry } from './langchainChatService.js';
import type { Message } from '../domain/sessionStore.js';

const toLangChainMessage = (message: Message): BaseMessage => {
  if (message.role === 'user') {
    return new HumanMessage(message.content);
  }

  return new AIMessage(message.content);
};

const createTimelineEvent = (
  stage: 'plan' | 'tool' | 'reason',
  status: 'start' | 'end' | 'info',
  message: string,
): LangChainStreamEvent => ({
  type: 'timeline',
  stage,
  status,
  message,
  timestamp: Date.now(),
});

const readMessageText = (message: BaseMessage | undefined): string => {
  if (!message) return '';
  const raw = (message as any).content;

  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          const maybeText = (item as { text?: unknown }).text;
          return typeof maybeText === 'string' ? maybeText : '';
        }
        return '';
      })
      .join('');
  }

  if (typeof raw === 'object' && raw !== null) {
    const maybeText = (raw as { text?: unknown }).text;
    return typeof maybeText === 'string' ? maybeText : '';
  }

  return '';
};

/**
 * 基于 LangGraph React Agent 的工作流流式回复（默认 linear，不破坏现有 SSE 协议）。
 * - 复用已有工具注册表（token_estimator / attention_probe）。
 * - 按 messagesState 输出 AI 文本增量，timeline 仅给出开始/结束提示。
 * - 后续可在此节点内扩展自定义图（分支/循环/并行）与更丰富的 timeline 事件。
 */
export async function* streamLangGraphReply(params: {
  prompt: string;
  history: Message[];
  memorySummary?: string;
  sessionId?: string;
}): AsyncGenerator<LangChainStreamEvent> {
  yield createTimelineEvent('plan', 'start', 'LangGraph React Agent 初始化。');

  const agent = createReactAgent({
    llm: chatModel,
    tools: Object.values(toolRegistry),
  });

  const initialMessages: BaseMessage[] = [
    ...(params.memorySummary && params.memorySummary.trim().length > 0
      ? [new SystemMessage(`Conversation memory summary:\n${params.memorySummary}`)]
      : []),
    ...params.history.map(toLangChainMessage),
    new HumanMessage(params.prompt),
  ];

  yield createTimelineEvent('plan', 'info', 'LangGraph 已启动，进入流式推理。');
  yield createTimelineEvent('reason', 'start', 'LangGraph 推理开始。');

  const stream = await agent.stream(
    { messages: initialMessages },
    {
      streamMode: 'values',
      configurable: { thread_id: params.sessionId ?? `session-${Date.now()}` },
    },
  );

  let previousText = '';

  for await (const state of stream) {
    const messages = (state as any)?.messages as BaseMessage[] | undefined;
    if (!messages || messages.length === 0) {
      continue;
    }

    const lastAssistant = [...messages].reverse().find((msg) => {
      const type = (msg as any)?._getType?.() || (msg as any)?.type;
      return type === 'ai' || type === 'assistant';
    });

    const fullText = readMessageText(lastAssistant);
    if (!fullText) {
      continue;
    }

    const delta = fullText.slice(previousText.length);
    if (delta.length === 0) {
      continue;
    }

    previousText = fullText;
    yield { type: 'content', content: delta } satisfies LangChainStreamEvent;
  }

  yield createTimelineEvent('reason', 'end', 'LangGraph 推理完成。');
}
