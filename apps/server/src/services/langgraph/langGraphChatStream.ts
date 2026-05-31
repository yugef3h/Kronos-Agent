import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import type { Message } from '../../models/sessionStore.js';
import { env } from '../../core/config/env.js';
import { buildUserHumanMessage } from '../chat/buildUserHumanMessage.js';
import { DEFAULT_SYSTEM_PROMPT } from '../chat/defaultSystemPrompt.js';
import { buildPlaygroundGatewayContext } from '../../ai/gateway/buildPlaygroundGatewayContext.js';
import { getPlaygroundChatModel } from '../../ai/gateway/getPlaygroundChatModel.js';
import { resolveDegradePolicy } from '../../ai/circuit/resolveDegradePolicy.js';
import type { LangChainStreamEvent } from '../chat/streamEventTypes.js';
import { createTimelineEvent } from '../chat/timelineEvents.js';
import { buildPlaygroundAgentSystemHint, listRegistryTools } from '../tools/index.js';
import { playgroundToolRegistry } from '../tools/playgroundToolRegistry.js';
import type { PlaygroundToolRegistry } from '../tools/types.js';
import {
  findCurrentTurnAssistantText,
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

/** 方案 B：LangGraph React Agent。 */
export async function* streamLangGraphChatReply(params: {
  prompt: string;
  history: Message[];
  memorySummary?: string;
  sessionId?: string;
  userId?: string;
  imageDataUrls?: string[];
  registry?: PlaygroundToolRegistry;
}): AsyncGenerator<LangChainStreamEvent> {
  const registry = params.registry ?? playgroundToolRegistry;
  const tools = listRegistryTools(registry);
  const agentHint = buildPlaygroundAgentSystemHint(registry);

  yield createTimelineEvent('plan', 'start', 'LangGraph React Agent 初始化。');

  const sessionId = params.sessionId ?? 'session';
  const loadPercent = Number(process.env.AI_LOAD_PERCENT ?? '0');
  const degradePolicy = resolveDegradePolicy(Number.isFinite(loadPercent) ? loadPercent : 0);
  const gatewayCtx = buildPlaygroundGatewayContext({
    userId: params.userId,
    sessionId,
    suffix: 'langgraph',
  });
  const model = getPlaygroundChatModel(gatewayCtx, {
    temperature: 0.5,
    maxTokens: degradePolicy.maxOutputTokens,
  });

  const agent = createReactAgent({
    llm: model,
    tools,
  });

  const initialMessages: BaseMessage[] = [
    new SystemMessage(DEFAULT_SYSTEM_PROMPT),
    ...(agentHint ? [new SystemMessage(agentHint)] : []),
    ...(params.memorySummary && params.memorySummary.trim().length > 0
      ? [new SystemMessage(`Conversation memory summary:\n${params.memorySummary}`)]
      : []),
    ...params.history.map(toLangChainMessage),
    buildUserHumanMessage(params.prompt, params.imageDataUrls),
  ];

  yield createTimelineEvent('plan', 'info', `LangGraph 已启动（已注册 ${tools.length} 个工具）。`);
  yield createTimelineEvent('reason', 'start', 'LangGraph 推理开始。');

  // 每轮独立 thread，避免 checkpoint 污染；会话历史已由 initialMessages 传入。
  const turnThreadId = `${sessionId}-turn-${Date.now()}`;
  const recursionLimit = Math.min(env.LANGGRAPH_MAX_TOOL_STEPS, degradePolicy.maxToolSteps);

  const stream = await agent.stream(
    { messages: initialMessages },
    {
      streamMode: ['updates', 'values'] as ['updates', 'values'],
      configurable: { thread_id: turnThreadId },
      recursionLimit,
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
        const fullText = findCurrentTurnAssistantText(messages ?? []);
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
      const fullText = findCurrentTurnAssistantText(messages);
      const delta = fullText.slice(previousText.length);
      if (delta.length > 0) {
        previousText = fullText;
        yield { type: 'content', content: delta };
      }
    }
  }

  yield createTimelineEvent('reason', 'end', 'LangGraph 推理完成。');
}
