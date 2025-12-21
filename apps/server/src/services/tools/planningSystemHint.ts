import type { PlaygroundToolRegistry } from './types.js';
import { buildPlaygroundAgentSystemHint } from './playgroundAgentSystemHint.js';

/** 线性路径 plan 阶段系统提示（与 Agent 路径共用文案）。 */
export const buildPlanningSystemHint = (registry: PlaygroundToolRegistry): string | null => {
  return buildPlaygroundAgentSystemHint(registry);
};

export { buildPlaygroundAgentSystemHint } from './playgroundAgentSystemHint.js';
