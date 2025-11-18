import { env } from '../config/env.js';

/** `self`（默认）| `langchain` — 大小写不敏感；`langchain` 下可选 `RAG_LC_MULTI_QUERY` 多查询改写。 */
export type RagEngineMode = 'self' | 'langchain';

export function getRagEngineMode(): RagEngineMode {
  const raw = env.RAG_ENGINE_MODE?.trim().toLowerCase() ?? '';
  if (raw === 'langchain') {
    return 'langchain';
  }
  return 'self';
}
