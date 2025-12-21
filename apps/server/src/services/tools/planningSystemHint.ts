import type { PlaygroundToolRegistry } from './types.js';

// 构建规划阶段系统提示
export const buildPlanningSystemHint = (registry: PlaygroundToolRegistry): string | null => {
  if (!registry.web_search) {
    return null;
  }

  return [
    'You are the planning phase for a Playground assistant.',
    'Available tools:',
    '- web_search: call for live web facts (news, prices, weather, releases, events after your knowledge cutoff, or when the user says today/latest/now/今年/最近).',
    'Rules:',
    '- Use web_search when freshness or external facts are required.',
    '- Do not call web_search for pure reasoning, coding help, or translation without needing live data.',
    '- Prefer a concise search query in the user language.',
  ].join('\n');
};
