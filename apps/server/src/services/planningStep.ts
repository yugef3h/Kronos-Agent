import type { AIMessage } from '@langchain/core/messages';
import { extractModelToolCalls } from './toolCallExtractor.js';
import type { ModelToolCall } from './toolCallExtractor.js';

const PLANNING_TIMEOUT = Symbol('planning_timeout');

export type PlanningStepResult = {
  modelToolCalls: ModelToolCall[];
  message: string;
  elapsedMs: number;
  timedOut: boolean;
};

const toSafeErrorText = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim().slice(0, 140);
  }

  return 'unknown error';
};

export const runPlanningStep = async (params: {
  invokePlanning: () => Promise<AIMessage>;
  timeoutMs: number;
}): Promise<PlanningStepResult> => {
  const startedAt = Date.now();
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<typeof PLANNING_TIMEOUT>((resolve) => {
    timeoutHandle = setTimeout(() => resolve(PLANNING_TIMEOUT), params.timeoutMs);
  });

  try {
    const planningResult = await Promise.race([params.invokePlanning(), timeoutPromise]);
    const elapsedMs = Date.now() - startedAt;

    if (planningResult === PLANNING_TIMEOUT) {
      return {
        modelToolCalls: [],
        message: `规划器超过 ${params.timeoutMs}ms 未返回，已跳过工具决策并直接进入推理阶段。`,
        elapsedMs,
        timedOut: true,
      };
    }

    const modelToolCalls = extractModelToolCalls(planningResult);

    return {
      modelToolCalls,
      message:
        modelToolCalls.length > 0
          ? `模型决策调用工具：${modelToolCalls.map((item) => item.name).join('、')}（规划耗时 ${elapsedMs}ms）`
          : `模型决策为无工具调用，直接进入推理阶段。（规划耗时 ${elapsedMs}ms）`,
      elapsedMs,
      timedOut: false,
    };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const errorText = toSafeErrorText(error);

    return {
      modelToolCalls: [],
      message: `规划器调用失败（${errorText}），已跳过工具决策并直接进入推理阶段。（规划耗时 ${elapsedMs}ms）`,
      elapsedMs,
      timedOut: false,
    };
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};
