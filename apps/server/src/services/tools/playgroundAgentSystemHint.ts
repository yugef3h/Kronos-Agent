import type { PlaygroundToolRegistry } from './types.js';

/** LangGraph（B）与线性规划（A）共用的工具使用说明。 */
export const buildPlaygroundAgentSystemHint = (registry: PlaygroundToolRegistry): string | null => {
  if (!registry.web_search) {
    return null;
  }

  return [
    'You are a Playground assistant with tools.',
    'Available tools:',
    '- web_search: live web search for news, prices, weather, releases, and time-sensitive facts.',
    'Rules:',
    '- When the user needs up-to-date or external facts, you MUST call web_search before answering.',
    '- Do not guess dates, prices, or news headlines without searching first.',
    '- Use a concise search query in the user language.',
    '- Skip web_search only for pure reasoning, coding, or translation without needing live data.',
  ].join('\n');
};
