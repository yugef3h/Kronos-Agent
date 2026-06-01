import { getCacheStore } from '../cache/getCacheStore.js';
import { hashCacheKey } from '../cache/hashCacheKey.js';
import type { CacheStore } from '../cache/cacheStore.js';
import type { StructuredToolInterface } from '@langchain/core/tools';

/** 子问题拆解计划 */
export type CachedPlan = {
  subQuestions: string[];
  reasoning: string;
};

/** 工具调用缓存条目 */
export type CachedToolResult = {
  toolName: string;
  input: unknown;
  output: unknown;
};

/** Agent 中间状态缓存 TTL 配置 */
const PLAN_TTL_MS = 30 * 60 * 1000;    // 子问题拆解：30 分钟
const TOOL_TTL_MS = 10 * 60 * 1000;    // 工具调用结果：10 分钟
const REASON_TTL_MS = 5 * 60 * 1000;   // 中间推理：5 分钟

/** Agent 中间状态缓存层 */
export type AgentStateCacheLayer = 'agent_plan' | 'agent_tool' | 'agent_reason';

/** 构建子问题拆解缓存键 */
export const buildAgentPlanCacheKey = (prompt: string, model: string): string =>
  hashCacheKey('agent_plan', { prompt: prompt.trim(), model });

/** 构建工具调用缓存键 */
export const buildAgentToolCacheKey = (toolName: string, input: unknown): string =>
  hashCacheKey('agent_tool', {
    toolName,
    inputHash: JSON.stringify(input),
  });

/** 构建中间推理缓存键 */
export const buildAgentReasonCacheKey = (prompt: string, stepIndex: number): string =>
  hashCacheKey('agent_reason', { prompt: prompt.trim(), step: stepIndex });

/** 查询子问题拆解计划缓存 */
export const getCachedAgentPlan = async (store: CacheStore, prompt: string, model: string): Promise<CachedPlan | null> => {
  const key = buildAgentPlanCacheKey(prompt, model);
  const entry = await store.get(key);
  return (entry?.value as CachedPlan | undefined) ?? null;
};

/** 写入子问题拆解计划缓存 */
export const setCachedAgentPlan = async (
  store: CacheStore,
  prompt: string,
  model: string,
  plan: CachedPlan,
): Promise<void> => {
  const key = buildAgentPlanCacheKey(prompt, model);
  await store.set(key, plan, PLAN_TTL_MS);
};

/** 查询工具调用结果缓存 */
export const getCachedAgentToolResult = async (
  store: CacheStore,
  toolName: string,
  input: unknown,
): Promise<CachedToolResult | null> => {
  const key = buildAgentToolCacheKey(toolName, input);
  const entry = await store.get(key);
  return (entry?.value as CachedToolResult | undefined) ?? null;
};

/** 写入工具调用结果缓存 */
export const setCachedAgentToolResult = async (
  store: CacheStore,
  toolName: string,
  input: unknown,
  output: unknown,
): Promise<void> => {
  const key = buildAgentToolCacheKey(toolName, input);
  await store.set(key, { toolName, input, output }, TOOL_TTL_MS);
};

/** 查询中间推理缓存 */
export const getCachedAgentReason = async (
  store: CacheStore,
  prompt: string,
  stepIndex: number,
): Promise<string | null> => {
  const key = buildAgentReasonCacheKey(prompt, stepIndex);
  const entry = await store.get(key);
  return typeof entry?.value === 'string' ? entry.value : null;
};

/** 写入中间推理缓存 */
export const setCachedAgentReason = async (
  store: CacheStore,
  prompt: string,
  stepIndex: number,
  text: string,
): Promise<void> => {
  const key = buildAgentReasonCacheKey(prompt, stepIndex);
  await store.set(key, text, REASON_TTL_MS);
};

/** Agent 工具调用是否启用 L3 缓存 */
const isAgentToolCacheEnabled = (): boolean =>
  (process.env.AI_AGENT_TOOL_CACHE_ENABLED ?? 'true').trim().toLowerCase() !== 'false';

/**
 * 为 LangChain StructuredTool 包裹 L3 缓存层。
 * 调用前查缓存 → 命中则直接返回；未命中则执行工具 → 写缓存。
 */
export const wrapToolWithCache = (
  tool: StructuredToolInterface,
  store: CacheStore,
): StructuredToolInterface => {
  if (!isAgentToolCacheEnabled()) {
    return tool;
  }

  const originalInvoke = tool.invoke.bind(tool);

  const cachedInvoke = async (input: unknown, config?: unknown): Promise<unknown> => {
    const cached = await getCachedAgentToolResult(store, tool.name, input);
    if (cached?.output) {
      return cached.output;
    }

    const output = await originalInvoke(input, config);
    void setCachedAgentToolResult(store, tool.name, input, output).catch(() => {
      // 静默失败，不影响主流程
    });
    return output;
  };

  return Object.create(tool, {
    invoke: { value: cachedInvoke, writable: false, configurable: true },
  }) as StructuredToolInterface;
};

/**
 * 批量包裹工具列表，为每个工具添加 L3 缓存层
 */
export const wrapToolsWithCache = (
  tools: StructuredToolInterface[],
  store = getCacheStore(),
): StructuredToolInterface[] => tools.map((tool) => wrapToolWithCache(tool, store));
