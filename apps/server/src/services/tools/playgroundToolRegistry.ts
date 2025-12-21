import { env } from '../../config/env.js';
import { buildToolRegistry } from './buildToolRegistry.js';
import type { PlaygroundToolRegistry } from './types.js';

/** 进程级工具注册表（由 env 决定启用哪些工具）。 */
export const playgroundToolRegistry: PlaygroundToolRegistry = buildToolRegistry({
  tavilyApiKey: env.TAVILY_API_KEY,
});
