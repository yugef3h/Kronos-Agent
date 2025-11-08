import { env } from '../config/env.js';

export type RagEngineMode = 'self' | 'langchain';

export function getRagEngineMode(): RagEngineMode {
  const raw = env.RAG_ENGINE_MODE?.trim().toLowerCase() ?? '';
  if (raw === 'langchain') {
    return 'langchain';
  }
  return 'self';
}
