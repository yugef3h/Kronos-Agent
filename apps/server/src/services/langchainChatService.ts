import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import type { Message } from '../domain/sessionStore.js';
import { env } from '../config/env.js';
import { selectToolNamesFromPrompt } from './toolSelector.js';
import { normalizeStreamDelta } from './streamDelta.js';

type TimelineEvent = {
  type: 'timeline';
  stage: 'plan' | 'tool' | 'reason';
  status: 'start' | 'end' | 'info';
  message: string;
  toolName?: string;
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

const createTimelineEvent = (
  stage: 'plan' | 'tool' | 'reason',
  status: 'start' | 'end' | 'info',
  message: string,
  toolName?: string,
): TimelineEvent => ({
  type: 'timeline',
  stage,
  status,
  message,
  toolName,
  timestamp: Date.now(),
});

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
}): AsyncGenerator<LangChainStreamEvent> {
  yield createTimelineEvent('plan', 'start', 'Planner started analyzing prompt intent.');

  const selectedToolNames = selectToolNamesFromPrompt(params.prompt);

  yield createTimelineEvent(
    'plan',
    'info',
    selectedToolNames.length > 0
      ? `Planner selected tools: ${selectedToolNames.join(', ')}`
      : 'Planner selected no tools, proceeding directly to model reasoning.',
  );

  const toolOutputs: string[] = [];

  for (const toolName of selectedToolNames) {
    const selectedTool = toolRegistry[toolName as keyof typeof toolRegistry];

    if (!selectedTool) {
      continue;
    }

    yield createTimelineEvent('tool', 'start', `${toolName} execution started.`, toolName);
    const output = await selectedTool.invoke({ text: params.prompt });
    toolOutputs.push(`${toolName}: ${output}`);
    yield createTimelineEvent('tool', 'end', `${toolName} execution finished.`, toolName);
  }

  yield createTimelineEvent('reason', 'start', 'Reasoner started streaming response.');

  const messages = [
    ...params.history.map(toLangChainMessage),
    new SystemMessage(
      toolOutputs.length > 0
        ? `Tool observations:\n${toolOutputs.join('\n')}`
        : 'No tools were used for this request.',
    ),
    new HumanMessage(params.prompt),
  ];

  const stream = await chatModel.stream(messages);
  let previousChunkText = '';

  for await (const chunk of stream) {
    const rawContent = readChunkText(chunk.content);
    const content = normalizeStreamDelta(previousChunkText, rawContent);

    if (rawContent.length > 0) {
      previousChunkText = rawContent;
    }

    if (content.length > 0) {
      yield {
        type: 'content',
        content,
      };
    }
  }

  yield createTimelineEvent('reason', 'end', 'Reasoner finished streaming response.');
}
