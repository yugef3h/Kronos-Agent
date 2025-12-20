import { tavily } from '@tavily/core';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatTavilyResultsForLlm, type TavilySearchHit } from './formatTavilyResults.js';

export const WEB_SEARCH_TOOL_NAME = 'web_search' as const;

// 创建 Tavily Web 搜索工具
export const createTavilyWebSearchTool = (apiKey: string) => {
  const client = tavily({ apiKey });

  return tool(
    async ({ query }) => {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length === 0) {
        return 'web_search: empty query';
      }

      const response = await client.search(trimmedQuery, {
        maxResults: 5,
        searchDepth: 'basic',
      });

      const results = (response.results ?? []) as TavilySearchHit[];
      return formatTavilyResultsForLlm(trimmedQuery, results);
    },
    {
      name: WEB_SEARCH_TOOL_NAME,
      description:
        'Search the live web for current events, news, prices, weather, product releases, and any time-sensitive facts. Use when the user asks about "today", "latest", "now", or specific dates after your knowledge cutoff.',
      schema: z.object({
        query: z.string().min(1).describe('Concise search query in the user language.'),
      }),
    },
  );
};
