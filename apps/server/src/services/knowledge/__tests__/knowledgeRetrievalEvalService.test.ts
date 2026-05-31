import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { KnowledgeRetrievalQuery, KnowledgeRetrievalQueryResult } from '../knowledgeRetrievalService.js';

const mockRunKnowledgeRetrievalQuery = jest.fn<
  (query: KnowledgeRetrievalQuery) => Promise<KnowledgeRetrievalQueryResult>
>();

jest.mock('../rag/knowledgeFacade.js', () => ({
  runKnowledgeRetrievalQuery: (query: KnowledgeRetrievalQuery) => mockRunKnowledgeRetrievalQuery(query),
}));
import {
  charLevelF1,
  evaluateKnowledgeRetrievalRun,
  exactMatchAnswer,
  hallucinationCharMissRate,
} from '../knowledgeRetrievalEvalService.js';

const minimalItem = (overrides: Partial<{ chunk_id: string; text: string }> = {}) => ({
  dataset_id: 'ds',
  dataset_name: 'ds',
  document_id: 'doc',
  document_name: 'doc',
  chunk_id: overrides.chunk_id ?? 'c1',
  chunk_index: 0,
  text: overrides.text ?? 'hello world',
  score: 1,
  search_method: 'semantic_search' as const,
  matched_terms: [] as string[],
  metadata: {} as Record<string, string>,
  token_count: 2,
  char_count: 11,
});

const minimalResult = (items: ReturnType<typeof minimalItem>[]): KnowledgeRetrievalQueryResult => ({
  query: 'q',
  items,
  diagnostics: {
    retrieval_mode: 'oneWay',
    dataset_count: 1,
    total_chunk_count: items.length,
    filtered_chunk_count: items.length,
  },
});

const shared = {
  dataset_ids: ['ds'],
  retrieval_mode: 'oneWay' as const,
  single_retrieval_config: { model: 'm', top_k: 3, score_threshold: null as number | null },
  multiple_retrieval_config: { top_k: 3, score_threshold: null, reranking_enable: false },
  metadata_filtering_mode: 'disabled' as const,
  metadata_filtering_conditions: [] as Array<{ field: string; operator: 'contains'; value: string }>,
};

describe('knowledgeRetrievalEvalService', () => {
  beforeEach(() => {
    mockRunKnowledgeRetrievalQuery.mockReset();
  });

  it('charLevelF1 is 1 for identical normalized strings', () => {
    expect(charLevelF1('a b', 'ab').f1).toBe(1);
  });

  it('exactMatchAnswer treats whitespace-normalized strings as equal', () => {
    expect(exactMatchAnswer('x y', 'xy')).toBe(1);
  });

  it('hallucinationCharMissRate measures chars absent from evidence', () => {
    expect(hallucinationCharMissRate('abc', ['ab'])).toBeCloseTo(1 / 3);
  });

  it('evaluateKnowledgeRetrievalRun sets recall and mrr when gold hits ranked list', async () => {
    mockRunKnowledgeRetrievalQuery.mockResolvedValue(
      minimalResult([minimalItem({ chunk_id: 'g1', text: 't1' }), minimalItem({ chunk_id: 'g2', text: 't2' })]),
    );

    const out = await evaluateKnowledgeRetrievalRun({
      shared,
      cases: [{ query: 'q1', gold_chunk_ids: ['g2'] }],
    });

    expect(out.cases[0]?.recall_at_k).toBe(1);
    expect(out.cases[0]?.mrr).toBe(0.5);
    expect(out.summary.recall_at_k).toBe(1);
    expect(out.summary.mrr).toBe(0.5);
  });

  it('evaluateKnowledgeRetrievalRun computes em from chunk text join vs expected_answer', async () => {
    mockRunKnowledgeRetrievalQuery.mockResolvedValue(minimalResult([minimalItem({ text: 'only' })]));

    const out = await evaluateKnowledgeRetrievalRun({
      shared,
      cases: [{ query: 'q1', expected_answer: 'only' }],
    });

    expect(out.cases[0]?.em).toBe(1);
    expect(out.cases[0]?.f1).toBe(1);
  });
});
