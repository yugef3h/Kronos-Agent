import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { HOT_TOPICS_PROMPT } from '../const/prompt.js';

export const FALLBACK_HOT_TOPICS = [
  '最近有什么新的科技资讯值得关注',
  'AI 岗位工程师需求激增，背后原因是什么',
  '最新 AI 布局会影响哪些行业',
  '大模型这半年各个大厂有哪些关键进展',
  '机器人和自动驾驶最近有哪些突破',
] as const;

export type HotTopicsResult = {
  topics: string[];
  source: 'model' | 'fallback';
};

const hotTopicsSchema = z.object({
  items: z.array(z.string().trim().min(1).max(40)).min(5).max(10),
});

const createHotTopicModel = (): ChatOpenAI | null => {
  const apiKey = process.env.DOUBAO_API_KEY || '';
  const baseURL = process.env.DOUBAO_BASE_URL || '';
  const model = process.env.DOUBAO_MODEL || '';

  if (!apiKey || !baseURL || !model) {
    return null;
  }

  return new ChatOpenAI({
    model,
    apiKey,
    configuration: {
      baseURL,
    },
    temperature: 0.7,
  });
};

const normalizeMessageContent = (content: unknown): string => {
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
          const text = (item as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }

        return '';
      })
      .join('')
      .trim();
  }

  return '';
};

const extractJsonPayload = (output: string): string => {
  const fencedMatch = output.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const objectMatch = output.match(/\{[\s\S]*\}/);
  return objectMatch?.[0]?.trim() || output.trim();
};

const sanitizeTopic = (topic: string): string => {
  return topic
    .replace(/^[\s\-*.\d、]+/, '')
    .replace(/[。；;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const parseHotTopicsOutput = (output: string): string[] => {
  try {
    const payload = JSON.parse(extractJsonPayload(output)) as unknown;
    const parsed = hotTopicsSchema.parse(payload);

    return parsed.items
      .map(sanitizeTopic)
      .filter(Boolean)
      .filter((topic, index, topics) => topics.indexOf(topic) === index)
      .slice(0, 5);
  } catch {
    return [];
  }
};

export const generateHotTopics = async (): Promise<HotTopicsResult> => {
  try {
    const model = createHotTopicModel();
    if (!model) {
      return { topics: [...FALLBACK_HOT_TOPICS], source: 'fallback' };
    }

    const response = await model.invoke([
      new SystemMessage(HOT_TOPICS_PROMPT),
      new HumanMessage('生成今日热门提问'),
    ]);

    const topics = parseHotTopicsOutput(normalizeMessageContent(response.content));
    if (topics.length === 5) {
      return { topics, source: 'model' };
    }
  } catch {
    // 模型不可用时退回内置热门话题，保证首页可用。
  }

  return { topics: [...FALLBACK_HOT_TOPICS], source: 'fallback' };
};