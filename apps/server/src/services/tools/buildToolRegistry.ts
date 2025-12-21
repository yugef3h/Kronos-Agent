import type { PlaygroundToolRegistry } from './types.js';
import { createTavilyWebSearchTool } from './tavilyWebSearchTool.js';

export type BuildToolRegistryOptions = {
  tavilyApiKey?: string;
};

// 构建工具注册表
export const buildToolRegistry = (options: BuildToolRegistryOptions = {}): PlaygroundToolRegistry => {
  const registry: PlaygroundToolRegistry = {};

  const tavilyKey = options.tavilyApiKey?.trim();
  if (tavilyKey) {
    registry.web_search = createTavilyWebSearchTool(tavilyKey);
  }

  return registry;
};

export const listRegistryTools = (registry: PlaygroundToolRegistry) => {
  return Object.values(registry).filter((item): item is NonNullable<typeof item> => Boolean(item));
};
