import { CallbackHandler } from '@langfuse/langchain';
import type { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { env } from '../core/config/env.js';

/** 检查 LangFuse 环境变量是否完整配置。 */
function isLangfuseConfigured(): boolean {
  return Boolean(
    env.LANGFUSE_PUBLIC_KEY?.trim() &&
    env.LANGFUSE_SECRET_KEY?.trim() &&
    env.LANGFUSE_BASE_URL?.trim(),
  );
}

/**
 * 创建 LangFuse LangChain 回调处理器。
 * 若环境变量未完整配置则返回 null，调用方跳过链路追踪。
 */
export function createLangfuseHandler(
  overrides?: { sessionId?: string; userId?: string; tags?: string[] },
): BaseCallbackHandler | null {
  if (!isLangfuseConfigured()) {
    return null;
  }

  return new CallbackHandler({
    sessionId: overrides?.sessionId,
    userId: overrides?.userId,
    tags: overrides?.tags ?? ['kronos'],
  });
}
