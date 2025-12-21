import { WEB_SEARCH_TOOL_NAME } from './tavilyWebSearchTool.js';

// 解析工具调用输入
export const resolveToolInvokeInput = (
  toolName: string,
  args: unknown,
  fallbackPrompt: string,
): Record<string, unknown> => {
  if (typeof args !== 'object' || args === null) {
    return toolName === WEB_SEARCH_TOOL_NAME
      ? { query: fallbackPrompt }
      : { text: fallbackPrompt };
  }

  const record = args as Record<string, unknown>;

  if (toolName === WEB_SEARCH_TOOL_NAME) {
    const query = record.query;
    if (typeof query === 'string' && query.trim().length > 0) {
      return { query: query.trim() };
    }

    const text = record.text;
    if (typeof text === 'string' && text.trim().length > 0) {
      return { query: text.trim() };
    }

    return { query: fallbackPrompt };
  }

  const text = record.text;
  if (typeof text === 'string' && text.trim().length > 0) {
    return { text: text.trim() };
  }

  return { text: fallbackPrompt };
};
