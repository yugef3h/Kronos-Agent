import { env } from '../config/env.js';

/** `self`（默认）| `langchain` — 大小写不敏感；`langchain` 用 LC 向量；`RAG_LC_MULTI_QUERY` 对两引擎均生效（改写问句条数见 `query_variants`）。 */
export type RagEngineMode = 'self' | 'langchain';

export function getRagEngineMode(): RagEngineMode {
  const raw = env.RAG_ENGINE_MODE?.trim().toLowerCase() ?? '';
  if (raw === 'langchain') {
    return 'langchain';
  }
  return 'self';
}
