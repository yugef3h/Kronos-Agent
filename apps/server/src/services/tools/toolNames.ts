import type { PlaygroundToolName } from './types.js';

export const PLAYGROUND_TOOL_NAMES = ['web_search'] as const satisfies readonly PlaygroundToolName[];

export const isPlaygroundToolName = (name: string): name is PlaygroundToolName => {
  return (PLAYGROUND_TOOL_NAMES as readonly string[]).includes(name);
};
