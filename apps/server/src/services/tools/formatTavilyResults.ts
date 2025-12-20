export type TavilySearchHit = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
};

// 将 Tavily 搜索结果格式化为 LLM 可理解的格式
export const formatTavilyResultsForLlm = (query: string, results: TavilySearchHit[]): string => {
  if (results.length === 0) {
    return `No web results found for query: ${query}`;
  }

  const lines = results.map((item, index) => {
    const title = item.title?.trim() || 'Untitled';
    const url = item.url?.trim() || '';
    const snippet = item.content?.trim().slice(0, 400) || '';
    return [
      `[${index + 1}] ${title}`,
      url ? `URL: ${url}` : '',
      snippet ? `Snippet: ${snippet}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  });

  return [`Query: ${query}`, ...lines].join('\n\n');
};
