import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

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
 * 使用 LangChain `ChatOpenAI` 生成若干同义/改写查询，用于向量通道多视角打分（见 `vectorRetrieval`）。
 * 需 `RAG_LC_MULTI_QUERY=true` 且具备与聊天相同的 `DOUBAO_*` 环境变量。向量打分见 `vectorRetrieval.ts`。
 */
export async function expandRetrievalQueriesWithLangChain(userQuery: string): Promise<string[]> {
  const chat = createExpansionChat();
  if (!chat) {
    return [];
  }

  const response = await chat.invoke([
    new SystemMessage(
      'You rewrite user search queries for knowledge-base retrieval. Reply with JSON only, no markdown: '
        + '{"queries":["...","..."]}. Include 2 to 4 short alternative phrasings (same language as the user). '
        + 'Do not add keys other than "queries".',
    ),
    new HumanMessage(userQuery.trim() || '(empty)'),
  ]);

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

// 向量打分
export async function maybeExpandQueriesForLangchainRetrieval(original: string): Promise<string[]> {
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
    console.warn(`[rag/langchain] query expansion skipped: ${message}`);
    return [original];
  }
}
