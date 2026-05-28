import { ChatOpenAI } from '@langchain/openai';
import { ragQueryExpansionChatPrompt } from '../../prompts/ragQueryExpansionPrompt.js';

// 检查是否启用多查询
const isMultiQueryEnabled = () => {
  const value = process.env.RAG_LC_MULTI_QUERY?.trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
};

// 创建扩展聊天
const createExpansionChat = (): ChatOpenAI | null => {
  const apiKey = process.env.DOUBAO_API_KEY;
  const baseURL = process.env.DOUBAO_BASE_URL;
  const model = process.env.DOUBAO_MODEL;
  if (!apiKey?.trim() || !baseURL?.trim() || !model?.trim()) {
    return null;
  }

  return new ChatOpenAI({
    model,
    apiKey,
    configuration: { baseURL },
    temperature: 0.2,
  });
};

// 提取JSON对象
const extractJsonObject = (raw: string): Record<string, unknown> | null => {
  const trimmed = raw.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const messageContentToString = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (part && typeof part === 'object' && 'type' in part && (part as { type?: string }).type === 'text' && 'text' in part) {
          return String((part as { text?: string }).text ?? '');
        }

        return '';
      })
      .join('');
  }

  return '';
};

/**
 * 使用 LangChain `ChatOpenAI` 生成若干同义/改写查询，供自研与 LangChain 检索在语义通道做多 query 极大值融合。
 * 需 `RAG_LC_MULTI_QUERY=true` 且具备与聊天相同的 `DOUBAO_*` 环境变量。
 */
export async function expandRetrievalQueriesWithLangChain(userQuery: string): Promise<string[]> {
  const chat = createExpansionChat();
  if (!chat) {
    return [];
  }

  const messages = await ragQueryExpansionChatPrompt.formatMessages({
    userQuery: userQuery.trim() || '(empty)',
  });
  const response = await chat.invoke(messages);

  const parsed = extractJsonObject(messageContentToString(response.content));
  const list = parsed?.queries;
  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

/** 返回若干检索用问句（含原问句）；自研与 `langchain` 检索共用。 */
export async function maybeExpandRetrievalQueries(original: string): Promise<string[]> {
  const trimmed = original.trim();
  if (!trimmed) {
    return [original];
  }

  if (!isMultiQueryEnabled()) {
    return [original];
  }

  try {
    const extra = await expandRetrievalQueriesWithLangChain(trimmed);
    const merged = [trimmed, ...extra];
    return [...new Set(merged.map((item) => item.trim()).filter(Boolean))].slice(0, 5);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.warn(`[rag] query expansion skipped: ${message}`);
    return [original];
  }
}
