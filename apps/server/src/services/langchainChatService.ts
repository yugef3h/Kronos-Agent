import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import type { Message } from '../domain/sessionStore.js';
import { env } from '../config/env.js';
import { normalizeStreamDelta } from './streamDelta.js';
import { runPlanningStep } from './planningStep.js';
import {
  createFirstTokenInfoMessage,
  createFirstTokenSlowWarningMessage,
  createReasonCompletedMessage,
  createReasonRequestInfoMessage,
  raceFirstChunkWithTimeout,
} from './reasonTelemetry.js';

type TimelineEvent = {
  type: 'timeline';
  stage: 'plan' | 'tool' | 'reason';
  status: 'start' | 'end' | 'info';
  message: string;
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
  toolError?: string;
  timestamp: number;
};

type ContentEvent = {
  type: 'content';
  content: string;
};

export type LangChainStreamEvent = TimelineEvent | ContentEvent;

const toLangChainMessage = (message: Message): HumanMessage | AIMessage => {
  if (message.role === 'user') {
    return new HumanMessage(message.content);
  }

  return new AIMessage(message.content);
};

const chatModel = new ChatOpenAI({
  model: env.DOUBAO_MODEL,
  apiKey: env.DOUBAO_API_KEY,
  configuration: {
    baseURL: env.DOUBAO_BASE_URL,
  },
  temperature: 0.5,
});

const tokenEstimatorTool = tool(
  async ({ text }) => {
    const estimatedTokenCount = Math.max(1, Math.ceil(text.length / 3.8));
    return `Estimated token count: ${estimatedTokenCount}`;
  },
  {
    name: 'token_estimator',
    description: 'Estimate approximate token usage from user prompt.',
    schema: z.object({
      text: z.string(),
    }),
  },
);

const attentionProbeTool = tool(
  async ({ text }) => {
    const focusWords = text
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 5)
      .join(', ');

    return focusWords.length > 0
      ? `Potential high-attention tokens: ${focusWords}`
      : 'No obvious high-attention tokens detected.';
  },
  {
    name: 'attention_probe',
    description: 'Probe likely attention hotspots from prompt text.',
    schema: z.object({
      text: z.string(),
    }),
  },
);

const toolRegistry = {
  token_estimator: tokenEstimatorTool,
  attention_probe: attentionProbeTool,
};

const toolEnabledModel = chatModel.bindTools([tokenEstimatorTool, attentionProbeTool], {
  tool_choice: 'auto',
});

const createTimelineEvent = (
  stage: 'plan' | 'tool' | 'reason',
  status: 'start' | 'end' | 'info',
  message: string,
  toolName?: string,
  toolInput?: string,
  toolOutput?: string,
  toolError?: string,
): TimelineEvent => ({
  type: 'timeline',
  stage,
  status,
  message,
  toolName,
  toolInput,
  toolOutput,
  toolError,
  timestamp: Date.now(),
});

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const normalizeToolInput = (args: unknown, fallbackPrompt: string): { text: string } => {
  if (typeof args === 'object' && args !== null) {
    const maybeText = (args as { text?: unknown }).text;
    if (typeof maybeText === 'string' && maybeText.trim().length > 0) {
      return { text: maybeText };
    }
  }

  return { text: fallbackPrompt };
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

export async function* streamLangChainReply(params: {
  prompt: string;
  history: Message[];
  memorySummary?: string;
}): AsyncGenerator<LangChainStreamEvent> {
  yield createTimelineEvent('plan', 'start', '规划器开始分析当前提示词意图。');

  const planningMessages = [
    ...(params.memorySummary && params.memorySummary.trim().length > 0
      ? [new SystemMessage(`Conversation memory summary:\n${params.memorySummary}`)]
      : []),
    ...params.history.map(toLangChainMessage),
    new HumanMessage(params.prompt),
  ];

  // 规划阶段设置超时，避免上游抖动导致首个可见事件长时间卡住。
  const planningStep = await runPlanningStep({
    invokePlanning: () => toolEnabledModel.invoke(planningMessages),
    timeoutMs: env.DOUBAO_PLAN_TIMEOUT_MS,
  });
  const modelToolCalls = planningStep.modelToolCalls;

  yield createTimelineEvent(
    'plan',
    'info',
    planningStep.message,
  );

  const toolOutputs: string[] = [];

  for (const toolCall of modelToolCalls) {
    const selectedTool = toolRegistry[toolCall.name as keyof typeof toolRegistry];

    if (!selectedTool) {
      yield createTimelineEvent(
        'tool',
        'info',
        `模型尝试调用未知工具 ${toolCall.name}，已跳过。`,
        toolCall.name,
      );
      continue;
    }

    const normalizedInput = normalizeToolInput(toolCall.args, params.prompt);
    const serializedInput = safeStringify(normalizedInput);

    yield createTimelineEvent(
      'tool',
      'start',
      `工具 ${toolCall.name} 开始执行。`,
      toolCall.name,
      serializedInput,
    );

    try {
      const output = await selectedTool.invoke(normalizedInput);
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
    ...params.history.map(toLangChainMessage),
    new SystemMessage(
      toolOutputs.length > 0
        ? `Tool observations:\n${toolOutputs.join('\n')}`
        : 'No tools were used for this request.',
    ),
    ...(params.memorySummary && params.memorySummary.trim().length > 0
      ? [new SystemMessage(`Conversation memory summary:\n${params.memorySummary}`)]
      : []),
    new HumanMessage(params.prompt),
  ];

  const requestStartedAt = Date.now();
  const stream = await chatModel.stream(messages);
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

  const emitChunkAsContent = (chunk: { content: unknown }): ContentEvent | null => {
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
