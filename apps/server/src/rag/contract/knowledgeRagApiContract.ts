/** Step5 — 校验 `knowledge-retrieval/query` 响应形状（双引擎应对齐）；`diagnostics.query_variants` 可选。 */
import type { KnowledgeRetrievalQueryResult } from '../../services/knowledge/knowledgeRetrievalService.js';

const RETRIEVAL_ITEM_KEYS = [
  'dataset_id',
  'dataset_name',
  'document_id',
  'document_name',
  'chunk_id',
  'chunk_index',
  'text',
  'score',
  'search_method',
  'matched_terms',
  'metadata',
  'token_count',
  'char_count',
] as const;

/** Step5 — 校验 `knowledge-retrieval/query` 响应形状（双引擎应对齐）。 */
export function assertKnowledgeRetrievalQueryResultContract(result: KnowledgeRetrievalQueryResult): void {
  if (typeof result.query !== 'string') {
    throw new Error('contract: result.query must be string');
  }
  if (!Array.isArray(result.items)) {
    throw new Error('contract: result.items must be array');
  }
  const { diagnostics } = result;
  if (!diagnostics || typeof diagnostics !== 'object') {
    throw new Error('contract: result.diagnostics missing');
  }
  for (const key of ['retrieval_mode', 'dataset_count', 'total_chunk_count', 'filtered_chunk_count'] as const) {
    if (!(key in diagnostics)) {
      throw new Error(`contract: diagnostics.${key} missing`);
    }
  }

  for (const item of result.items) {
    for (const key of RETRIEVAL_ITEM_KEYS) {
      if (!(key in item)) {
        throw new Error(`contract: item missing ${key}`);
      }
    }
    if (!Array.isArray(item.matched_terms)) {
      throw new Error('contract: matched_terms must be array');
    }
    if (typeof item.metadata !== 'object' || item.metadata === null) {
      throw new Error('contract: metadata must be object');
    }
  }
}

/** Step5 — 校验 `preview-chunks` 单条 item 形状。 */
export function assertKnowledgePreviewItemContract(item: {
  fileName: unknown;
  mimeType: unknown;
  totalChunks: unknown;
  preview: unknown;
}): void {
  if (typeof item.fileName !== 'string') {
    throw new Error('contract: preview item.fileName');
  }
  if (typeof item.mimeType !== 'string') {
    throw new Error('contract: preview item.mimeType');
  }
  if (typeof item.totalChunks !== 'number') {
    throw new Error('contract: preview item.totalChunks');
  }
  if (!Array.isArray(item.preview)) {
    throw new Error('contract: preview item.preview');
  }
  for (const chunk of item.preview) {
    if (!chunk || typeof chunk !== 'object') {
      throw new Error('contract: preview chunk');
    }
    const c = chunk as Record<string, unknown>;
    for (const key of ['id', 'index', 'text', 'tokenCount', 'charCount'] as const) {
      if (!(key in c)) {
        throw new Error(`contract: preview chunk missing ${key}`);
      }
    }
  }
}
