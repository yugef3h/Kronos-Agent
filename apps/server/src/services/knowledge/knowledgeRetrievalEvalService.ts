import type { KnowledgeRetrievalQuery, KnowledgeRetrievalQueryResult } from './knowledgeRetrievalService.js';
import { runKnowledgeRetrievalQuery } from '../../rag/knowledgeFacade.js';

export type KnowledgeRetrievalEvalCaseInput = {
  query: string;
  gold_chunk_ids?: string[];
  expected_answer?: string;
  generated_answer?: string;
};

export type KnowledgeRetrievalEvalCaseResult = {
  query: string;
  recall_at_k: number | null;
  mrr: number | null;
  /** 拼接 TopK chunk 文本 vs `expected_answer` 的规范化全等 */
  em: number | null;
  /** 字级 F1（归一化去空白后按 Unicode 码点） */
  f1: number | null;
  /**
   * 生成答案中「码点」不在检索证据并集内的比例（0–1）；仅当传入 `generated_answer` 时有值。
   * 免费启发式，不等价于业界「幻觉率」裁判。
   */
  hallucination_char_miss_rate: number | null;
  top_chunk_ids: string[];
};

export type KnowledgeRetrievalEvalSummary = {
  sample_count: number;
  recall_at_k: number | null;
  mrr: number | null;
  em: number | null;
  f1: number | null;
  hallucination_char_miss_rate: number | null;
};

export type KnowledgeRetrievalEvalRunResult = {
  cases: KnowledgeRetrievalEvalCaseResult[];
  summary: KnowledgeRetrievalEvalSummary;
};

const normalizeChars = (value: string) => value.normalize('NFKC').replace(/\s+/gu, '').trim();

/** 字级 F1（将字符串视为码点序列 multiset） */
export const charLevelF1 = (prediction: string, reference: string) => {
  const pred = normalizeChars(prediction);
  const ref = normalizeChars(reference);
  if (!ref.length) {
    return { precision: 0, recall: 0, f1: 0 };
  }

  const predCounts = new Map<string, number>();
  const refCounts = new Map<string, number>();

  for (const char of pred) {
    predCounts.set(char, (predCounts.get(char) ?? 0) + 1);
  }

  for (const char of ref) {
    refCounts.set(char, (refCounts.get(char) ?? 0) + 1);
  }

  let intersection = 0;
  for (const [char, count] of refCounts) {
    intersection += Math.min(count, predCounts.get(char) ?? 0);
  }

  const precision = pred.length ? intersection / pred.length : 0;
  const recall = ref.length ? intersection / ref.length : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  return { precision, recall, f1 };
};

export const exactMatchAnswer = (prediction: string, reference: string) => (
  normalizeChars(prediction) === normalizeChars(reference) ? 1 : 0
);

const evidenceCharSet = (chunkTexts: string[]) => {
  const set = new Set<string>();
  const merged = chunkTexts.join('\n');
  for (const char of normalizeChars(merged)) {
    set.add(char);
  }
  return set;
};

/**
 * 生成文本中，归一化后各码点不在「检索证据字符集合」中的比例。
 */
export const hallucinationCharMissRate = (generated: string, evidenceChunkTexts: string[]) => {
  const gen = normalizeChars(generated);
  if (!gen.length) {
    return 0;
  }

  const evidence = evidenceCharSet(evidenceChunkTexts);
  let miss = 0;
  for (const char of gen) {
    if (!evidence.has(char)) {
      miss += 1;
    }
  }

  return miss / gen.length;
};

const recallAndMrr = (result: KnowledgeRetrievalQueryResult, goldChunkIds: string[]) => {
  if (!goldChunkIds.length) {
    return { recall: null as number | null, mrr: null as number | null };
  }

  const orderedIds = result.items.map((item) => item.chunk_id);
  const gold = new Set(goldChunkIds);
  const recall = orderedIds.some((id) => gold.has(id)) ? 1 : 0;
  let mrr = 0;
  for (let index = 0; index < orderedIds.length; index += 1) {
    if (gold.has(orderedIds[index]!)) {
      mrr = 1 / (index + 1);
      break;
    }
  }

  return { recall, mrr };
};

const average = (values: number[]) => {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) {
    return null;
  }

  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
};

export async function evaluateKnowledgeRetrievalRun(params: {
  shared: Omit<KnowledgeRetrievalQuery, 'query'>;
  cases: KnowledgeRetrievalEvalCaseInput[];
}): Promise<KnowledgeRetrievalEvalRunResult> {
  const cases: KnowledgeRetrievalEvalCaseResult[] = [];

  for (const item of params.cases) {
    const query: KnowledgeRetrievalQuery = {
      ...params.shared,
      query: item.query,
    };
    const result = await runKnowledgeRetrievalQuery(query);
    const chunkTexts = result.items.map((row) => row.text);
    const predFromRetrieval = chunkTexts.join('\n').slice(0, 12_000);
    const { recall, mrr } = recallAndMrr(result, item.gold_chunk_ids ?? []);

    let em: number | null = null;
    let f1: number | null = null;
    if (typeof item.expected_answer === 'string' && item.expected_answer.trim()) {
      em = exactMatchAnswer(predFromRetrieval, item.expected_answer);
      f1 = charLevelF1(predFromRetrieval, item.expected_answer).f1;
    }

    let hallucination_char_miss_rate: number | null = null;
    if (typeof item.generated_answer === 'string' && item.generated_answer.trim()) {
      hallucination_char_miss_rate = hallucinationCharMissRate(item.generated_answer, chunkTexts);
    }

    cases.push({
      query: item.query,
      recall_at_k: recall,
      mrr,
      em,
      f1,
      hallucination_char_miss_rate,
      top_chunk_ids: result.items.map((row) => row.chunk_id),
    });
  }

  const summary: KnowledgeRetrievalEvalSummary = {
    sample_count: cases.length,
    recall_at_k: average(cases.map((row) => (row.recall_at_k == null ? Number.NaN : row.recall_at_k))),
    mrr: average(cases.map((row) => (row.mrr == null ? Number.NaN : row.mrr))),
    em: average(cases.map((row) => (row.em == null ? Number.NaN : row.em))),
    f1: average(cases.map((row) => (row.f1 == null ? Number.NaN : row.f1))),
    hallucination_char_miss_rate: average(
      cases.map((row) => (row.hallucination_char_miss_rate == null ? Number.NaN : row.hallucination_char_miss_rate)),
    ),
  };

  return { cases, summary };
}
