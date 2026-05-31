import type { KnowledgeRetrievalQuery, KnowledgeRetrievalQueryResult } from './knowledgeRetrievalService.js';
import { runKnowledgeRetrievalQuery } from '../../rag/knowledgeFacade.js';

export type KnowledgeRetrievalCompareResult = {
  query: string;
  dataset_ids: string[];
  a: {
    latencyMs: number;
    result: KnowledgeRetrievalQueryResult;
  };
  b: {
    latencyMs: number;
    result: KnowledgeRetrievalQueryResult;
  };
  overlapTopK: {
    chunkIdsInBoth: number;
    jaccardChunkIds: number;
  };
};

const jaccard = (left: Set<string>, right: Set<string>) => {
  if (!left.size && !right.size) {
    return 1;
  }

  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) {
      intersection += 1;
    }
  }

  const union = left.size + right.size - intersection;
  return union ? intersection / union : 0;
};

export async function compareKnowledgeRetrievalQueries(
  retrievalA: KnowledgeRetrievalQuery,
  retrievalB: KnowledgeRetrievalQuery,
): Promise<KnowledgeRetrievalCompareResult> {
  const t0 = performance.now();
  const resultA = await runKnowledgeRetrievalQuery(retrievalA);
  const t1 = performance.now();
  const resultB = await runKnowledgeRetrievalQuery(retrievalB);
  const t2 = performance.now();

  const idsA = new Set(resultA.items.map((item) => item.chunk_id));
  const idsB = new Set(resultB.items.map((item) => item.chunk_id));
  let chunkIdsInBoth = 0;
  for (const id of idsA) {
    if (idsB.has(id)) {
      chunkIdsInBoth += 1;
    }
  }

  return {
    query: retrievalA.query,
    dataset_ids: retrievalA.dataset_ids,
    a: {
      latencyMs: Math.round(t1 - t0),
      result: resultA,
    },
    b: {
      latencyMs: Math.round(t2 - t1),
      result: resultB,
    },
    overlapTopK: {
      chunkIdsInBoth,
      jaccardChunkIds: jaccard(idsA, idsB),
    },
  };
}
