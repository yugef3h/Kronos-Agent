import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import type { Message } from '../../domain/sessionStore.js';
import { env } from '../../config/env.js';
import { buildUserHumanMessage } from '../chat/buildUserHumanMessage.js';
import { chatModel } from '../chat/chatModel.js';
import type { LangChainStreamEvent } from '../chat/streamEventTypes.js';
import { createTimelineEvent } from '../chat/timelineEvents.js';
import { listRegistryTools } from '../tools/index.js';
import { playgroundToolRegistry } from '../tools/playgroundToolRegistry.js';
import type { PlaygroundToolRegistry } from '../tools/types.js';
import {
  findLatestAssistantText,
  mapLangGraphUpdateToTimelineEvents,
} from './toolStreamMapper.js';

type LangGraphStreamState = {
  messages?: BaseMessage[];
};

const toLangChainMessage = (message: Message): HumanMessage | AIMessage => {
  if (message.role === 'user') {
    return new HumanMessage(message.content);
  }

  return new AIMessage(message.content);
};

const isStreamTuple = (chunk: unknown): chunk is [string, unknown] => {
  return Array.isArray(chunk) && chunk.length === 2 && typeof chunk[0] === 'string';
};

/** 方案 B：LangGraph React Agent（主路径）。 */
export async function* streamLangGraphChatReply(params: {
  prompt: string;
  history: Message[];
  memorySummary?: string;
  sessionId?: string;
  imageDataUrls?: string[];
  registry?: PlaygroundToolRegistry;
}): AsyncGenerator<LangChainStreamEvent> {
  const registry = params.registry ?? playgroundToolRegistry;
  const tools = listRegistryTools(registry);

  yield createTimelineEvent('plan', 'start', 'LangGraph React Agent 初始化。');

  const agent = createReactAgent({
    llm: chatModel,
    tools,
  });

  const initialMessages: BaseMessage[] = [
    ...(params.memorySummary && params.memorySummary.trim().length > 0
      ? [new SystemMessage(`Conversation memory summary:\n${params.memorySummary}`)]
      : []),
    ...params.history.map(toLangChainMessage),
    buildUserHumanMessage(params.prompt, params.imageDataUrls),
  ];

  yield createTimelineEvent('plan', 'info', `LangGraph 已启动（已注册 ${tools.length} 个工具）。`);
  yield createTimelineEvent('reason', 'start', 'LangGraph 推理开始。');

  const stream = await agent.stream(
    { messages: initialMessages },
    {
      streamMode: ['updates', 'values'] as ['updates', 'values'],
      configurable: { thread_id: params.sessionId ?? `session-${Date.now()}` },
      recursionLimit: env.LANGGRAPH_MAX_TOOL_STEPS,
    },
  );

  let previousText = '';

  for await (const chunk of stream) {
    if (isStreamTuple(chunk)) {
      const [mode, payload] = chunk;

      if (mode === 'updates' && typeof payload === 'object' && payload !== null) {
        for (const [nodeName, nodeState] of Object.entries(payload)) {
          const messages = (nodeState as LangGraphStreamState).messages;
          if (!messages?.length) {
            continue;
          }

          for (const event of mapLangGraphUpdateToTimelineEvents(nodeName, messages)) {
            yield event;
          }
        }
        continue;
      }

      if (mode === 'values' && typeof payload === 'object' && payload !== null) {
        const messages = (payload as LangGraphStreamState).messages;
        const fullText = findLatestAssistantText(messages ?? []);
        const delta = fullText.slice(previousText.length);
        if (delta.length > 0) {
          previousText = fullText;
          yield { type: 'content', content: delta };
        }
      }

      continue;
    }

    if (typeof chunk === 'object' && chunk !== null && 'messages' in chunk) {
      const messages = (chunk as LangGraphStreamState).messages ?? [];
      const fullText = findLatestAssistantText(messages);
      const delta = fullText.slice(previousText.length);
      if (delta.length > 0) {
        previousText = fullText;
        yield { type: 'content', content: delta };
      }
    }
  }

  yield createTimelineEvent('reason', 'end', 'LangGraph 推理完成。');
}
