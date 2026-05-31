import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { Message } from '../../models/sessionStore.js';
import { env } from '../../core/config/env.js';
import { buildUserHumanMessage } from '../chat/buildUserHumanMessage.js';
import { DEFAULT_SYSTEM_PROMPT } from '../chat/defaultSystemPrompt.js';
import { getPlaygroundChatModel } from '../../ai/gateway/getPlaygroundChatModel.js';
import { invokeGatewayLlm } from '../../ai/gateway/invokeGatewayLlm.js';
import { streamGatewayLlm } from '../../ai/gateway/streamGatewayLlm.js';
import type { ChatOpenAI } from '@langchain/openai';
import { safeStringify } from '../chat/safeStringify.js';
import type { LangChainStreamEvent } from '../chat/streamEventTypes.js';
import { createTimelineEvent } from '../chat/timelineEvents.js';
import { runPlanningStep } from '../planningStep.js';
import {
  createFirstTokenInfoMessage,
  createFirstTokenSlowWarningMessage,
  createReasonCompletedMessage,
  createReasonRequestInfoMessage,
  raceFirstChunkWithTimeout,
} from '../reasonTelemetry.js';
import { normalizeStreamDelta } from '../streamDelta.js';
import {
  buildPlanningSystemHint,
  getRegistryTool,
  invokePlaygroundTool,
  listRegistryTools,
  resolveToolInvokeInput,
  shouldUseWebSearch,
} from '../tools/index.js';
import { playgroundToolRegistry } from '../tools/playgroundToolRegistry.js';
import type { PlaygroundToolRegistry } from '../tools/types.js';
import type { ModelToolCall } from '../toolCallExtractor.js';
import { WEB_SEARCH_TOOL_NAME } from '../tools/tavilyWebSearchTool.js';

const toLangChainMessage = (message: Message): HumanMessage | AIMessage => {
  if (message.role === 'user') {
    return new HumanMessage(message.content);
  }

  return new AIMessage(message.content);
};

const readChunkText = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (typeof item === 'object' && item !== null) {
          const maybeText = (item as { text?: unknown }).text;
          return typeof maybeText === 'string' ? maybeText : '';
        }

        return '';
      })
      .join('');
  }

  return '';
};

const createToolEnabledModel = (registry: PlaygroundToolRegistry, model: ChatOpenAI) => {
  const tools = listRegistryTools(registry);
  if (tools.length === 0) {
    return model;
  }

  return model.bindTools(tools, { tool_choice: 'auto' });
};

const PLAYGROUND_CHAT_LOG_PREFIX = '[playground-chat]';

/** 方案 A：plan → tool → reason（线性兜底路径）。 */
export async function* streamLinearChatReply(params: {
  prompt: string;
  history: Message[];
  memorySummary?: string;
  imageDataUrls?: string[];
  registry?: PlaygroundToolRegistry;
  sessionId?: string;
  userId?: string;
}): AsyncGenerator<LangChainStreamEvent> {
  const registry = params.registry ?? playgroundToolRegistry;
  const sessionId = params.sessionId ?? 'session';
  const baseModel = getPlaygroundChatModel(
    {
      userId: params.userId,
      sessionId,
      intent: 'chat',
      traceId: `${sessionId}-linear-${Date.now()}`,
    },
    { temperature: 0.5 },
  );
  const toolEnabledModel = createToolEnabledModel(registry, baseModel);
  const planningHint = buildPlanningSystemHint(registry);

  yield createTimelineEvent('plan', 'start', '规划器开始分析当前提示词意图。');

  const planningMessages = [
    new SystemMessage(DEFAULT_SYSTEM_PROMPT),
    ...(planningHint ? [new SystemMessage(planningHint)] : []),
    ...(params.memorySummary && params.memorySummary.trim().length > 0
      ? [new SystemMessage(`Conversation memory summary:\n${params.memorySummary}`)]
      : []),
    ...params.history.map(toLangChainMessage),
    buildUserHumanMessage(params.prompt, params.imageDataUrls),
  ];

  const planningStep = await runPlanningStep({
    invokePlanning: () => invokeGatewayLlm(toolEnabledModel, planningMessages, { modelName: baseModel.model }),
    timeoutMs: env.DOUBAO_PLAN_TIMEOUT_MS,
  });
  let modelToolCalls: ModelToolCall[] = planningStep.modelToolCalls;

  yield createTimelineEvent('plan', 'info', planningStep.message);

  if (modelToolCalls.length === 0 && registry.web_search && shouldUseWebSearch(params.prompt)) {
    modelToolCalls = [{ name: WEB_SEARCH_TOOL_NAME, args: { query: params.prompt } }];
    console.warn(
      `${PLAYGROUND_CHAT_LOG_PREFIX} path=A-linear web_search rule-trigger sessionId=${params.sessionId ?? 'unknown'} timedOut=${planningStep.timedOut}`,
    );
    yield createTimelineEvent(
      'plan',
      'info',
      planningStep.timedOut
        ? '规划超时，已按实时性问题规则补调 web_search。'
        : '规划未选择工具，已按实时性问题规则补调 web_search。',
    );
  }

  const toolOutputs: string[] = [];

  for (const toolCall of modelToolCalls) {
    const selectedTool = getRegistryTool(registry, toolCall.name);

    if (!selectedTool) {
      yield createTimelineEvent(
        'tool',
        'info',
        `模型尝试调用未知工具 ${toolCall.name}，已跳过。`,
        toolCall.name,
      );
      continue;
    }

    const normalizedInput = resolveToolInvokeInput(toolCall.name, toolCall.args, params.prompt);
    const serializedInput = safeStringify(normalizedInput);

    yield createTimelineEvent(
      'tool',
      'start',
      `工具 ${toolCall.name} 开始执行。`,
      toolCall.name,
      serializedInput,
    );

    try {
      const output = await invokePlaygroundTool(selectedTool, normalizedInput);
      const serializedOutput = safeStringify(output);
      toolOutputs.push(`${toolCall.name}: ${serializedOutput}`);
      yield createTimelineEvent(
        'tool',
        'end',
        `工具 ${toolCall.name} 执行完成。`,
        toolCall.name,
        serializedInput,
        serializedOutput,
      );
    } catch (error) {
      const toolError =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'tool execution failed';

      yield createTimelineEvent(
        'tool',
        'end',
        `工具 ${toolCall.name} 执行失败。`,
        toolCall.name,
        serializedInput,
        undefined,
        toolError,
      );
    }
  }

  yield createTimelineEvent('reason', 'start', '推理器开始生成流式响应。');
  const reasonStartedAt = Date.now();

  const messages = [
    new SystemMessage(DEFAULT_SYSTEM_PROMPT),
    ...params.history.map(toLangChainMessage),
    new SystemMessage(
      toolOutputs.length > 0
        ? `Tool observations:\n${toolOutputs.join('\n')}\n\nCite sources when using web_search results.`
        : 'No tools were used for this request.',
    ),
    ...(params.memorySummary && params.memorySummary.trim().length > 0
      ? [new SystemMessage(`Conversation memory summary:\n${params.memorySummary}`)]
      : []),
    buildUserHumanMessage(params.prompt, params.imageDataUrls),
  ];

  const requestStartedAt = Date.now();
  const stream = await streamGatewayLlm(baseModel, messages);
  const requestSetupElapsedMs = Date.now() - requestStartedAt;

  yield createTimelineEvent('reason', 'info', createReasonRequestInfoMessage(requestSetupElapsedMs));

  const iterator = stream[Symbol.asyncIterator]();
  const firstChunkPromise = iterator.next();
  const firstChunkRace = await raceFirstChunkWithTimeout({
    firstChunkPromise,
    timeoutMs: env.DOUBAO_FIRST_TOKEN_WARN_MS,
  });

  if (firstChunkRace.timedOut) {
    yield createTimelineEvent(
      'reason',
      'info',
      createFirstTokenSlowWarningMessage(env.DOUBAO_FIRST_TOKEN_WARN_MS),
    );
  }

  const firstChunkResult = await firstChunkPromise;
  let previousChunkText = '';
  let firstTokenElapsedMs: number | null = null;

  const emitChunkAsContent = (chunk: { content: unknown }): LangChainStreamEvent | null => {
    const rawContent = readChunkText(chunk.content);
    const content = normalizeStreamDelta(previousChunkText, rawContent);

    if (rawContent.length > 0) {
      previousChunkText = rawContent;
    }

    if (content.length === 0) {
      return null;
    }

    if (firstTokenElapsedMs === null) {
      firstTokenElapsedMs = Date.now() - reasonStartedAt;
    }

    return {
      type: 'content',
      content,
    };
  };

  if (!firstChunkResult.done) {
    const firstContentEvent = emitChunkAsContent(firstChunkResult.value);

    if (firstTokenElapsedMs !== null) {
      yield createTimelineEvent('reason', 'info', createFirstTokenInfoMessage(firstTokenElapsedMs));
    }

    if (firstContentEvent) {
      yield firstContentEvent;
    }
  }

  while (true) {
    const chunkResult = await iterator.next();

    if (chunkResult.done) {
      break;
    }

    const contentEvent = emitChunkAsContent(chunkResult.value);
    if (contentEvent) {
      yield contentEvent;
    }
  }

  const totalElapsedMs = Date.now() - reasonStartedAt;
  yield createTimelineEvent(
    'reason',
    'end',
    createReasonCompletedMessage({
      totalElapsedMs,
      firstTokenElapsedMs,
    }),
  );
}
