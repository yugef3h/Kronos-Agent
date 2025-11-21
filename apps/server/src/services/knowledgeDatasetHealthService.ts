import {
  listKnowledgeDatasetChunks,
  listKnowledgeDocuments,
} from '../domain/knowledgeDocumentStore.js';

const TINY_CHUNK_CHARS = 80;
const NEAR_DICE_THRESHOLD = 0.9;
const MAX_NEAR_PAIRS_PER_DOC = 400;

const normalizeChunkText = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

const bigramSet = (text: string) => {
  const compact = normalizeChunkText(text).replace(/\s/g, '');
  const set = new Set<string>();
  for (let index = 0; index < compact.length - 1; index += 1) {
    set.add(compact.slice(index, index + 2));
  }
  return set;
};

const diceCoefficient = (left: Set<string>, right: Set<string>) => {
  if (!left.size || !right.size) {
    return 0;
  }

  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) {
      intersection += 1;
    }
  }

  return (2 * intersection) / (left.size + right.size);
};

const median = (values: number[]) => {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

const percentile = (values: number[], p: number) => {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const rank = (sorted.length - 1) * p;
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) {
    return sorted[low]!;
  }

  return sorted[low]! * (high - rank) + sorted[high]! * (rank - low);
};

export type KnowledgeDatasetHealthReport = {
  datasetId: string;
  documentCount: number;
  chunkCount: number;
  emptyDocuments: number;
  /** 规范化文本完全相同的 chunk 条数（不含每组保留的一条） */
  exactDuplicateChunkCount: number;
  /** 同文档内 Dice(bigram) ≥ 阈值的近重复对数（抽样有上限） */
  nearRedundantChunkPairCount: number;
  tinyChunkRatio: number;
  medianChunkChars: number;
  p90ChunkChars: number;
  /** 0–100，越高越健康 */
  healthScore: number;
  hints: string[];
};

export async function computeKnowledgeDatasetHealth(datasetId: string): Promise<KnowledgeDatasetHealthReport> {
  const documents = await listKnowledgeDocuments(datasetId);
  const records = await listKnowledgeDatasetChunks(datasetId);

  const emptyDocuments = documents.filter((document) => document.chunkCount === 0).length;
  const chunkCount = records.length;

  const textToChunkIds = new Map<string, string[]>();
  for (const record of records) {
    const key = normalizeChunkText(record.chunk.text);
    if (!key) {
      continue;
    }

    const list = textToChunkIds.get(key) ?? [];
    list.push(record.chunk.id);
    textToChunkIds.set(key, list);
  }

  let exactDuplicateChunkCount = 0;
  for (const ids of textToChunkIds.values()) {
    if (ids.length > 1) {
      exactDuplicateChunkCount += ids.length - 1;
    }
  }

  const charCounts = records.map((record) => record.chunk.charCount);
  const tinyChunkRatio = chunkCount ? records.filter((record) => record.chunk.charCount < TINY_CHUNK_CHARS).length / chunkCount : 0;
  const medianChunkChars = Math.round(median(charCounts));
  const p90ChunkChars = Math.round(percentile(charCounts, 0.9));

  const byDocument = new Map<string, typeof records>();
  for (const record of records) {
    const list = byDocument.get(record.document.id) ?? [];
    list.push(record);
    byDocument.set(record.document.id, list);
  }

  let nearRedundantChunkPairCount = 0;
  for (const chunks of byDocument.values()) {
    const eligible = chunks
      .filter((record) => record.chunk.charCount >= 60)
      .sort((left, right) => left.chunk.charCount - right.chunk.charCount)
      .slice(0, 60);

    let comparisons = 0;
    for (let index = 0; index < eligible.length && comparisons < MAX_NEAR_PAIRS_PER_DOC; index += 1) {
      const leftSet = bigramSet(eligible[index]!.chunk.text);
      for (let inner = index + 1; inner < eligible.length && comparisons < MAX_NEAR_PAIRS_PER_DOC; inner += 1) {
        comparisons += 1;
        const rightSet = bigramSet(eligible[inner]!.chunk.text);
        if (diceCoefficient(leftSet, rightSet) >= NEAR_DICE_THRESHOLD) {
          nearRedundantChunkPairCount += 1;
        }
      }
    }
  }

  let healthScore = 100;
  const hints: string[] = [];

  healthScore -= Math.min(40, emptyDocuments * 8);
  if (emptyDocuments) {
    hints.push(`有 ${emptyDocuments} 个文档 chunk 数为 0，建议检查解析或重新导入。`);
  }

  healthScore -= Math.min(35, exactDuplicateChunkCount * 3);
  if (exactDuplicateChunkCount) {
    hints.push(`检测到 ${exactDuplicateChunkCount} 条完全重复切片，可考虑去重或合并分段策略。`);
  }

  healthScore -= Math.min(25, nearRedundantChunkPairCount * 2);
  if (nearRedundantChunkPairCount) {
    hints.push(`同文档内约 ${nearRedundantChunkPairCount} 对高相似切片（Dice≥${NEAR_DICE_THRESHOLD}），存在冗余风险。`);
  }

  healthScore -= Math.min(30, tinyChunkRatio * 60);
  if (tinyChunkRatio > 0.15) {
    hints.push(`约 ${(tinyChunkRatio * 100).toFixed(0)}% 切片过短（<${TINY_CHUNK_CHARS} 字），碎片化偏高。`);
  }

  if (medianChunkChars > 0 && medianChunkChars < 120 && chunkCount > 5) {
    healthScore -= 10;
    hints.push('切片中位长度过短，可读性与检索粒度可能失衡。');
  }

  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  return {
    datasetId,
    documentCount: documents.length,
    chunkCount,
    emptyDocuments,
    exactDuplicateChunkCount,
    nearRedundantChunkPairCount,
    tinyChunkRatio: Math.round(tinyChunkRatio * 1000) / 1000,
    medianChunkChars,
    p90ChunkChars,
    healthScore,
    hints,
  };
}
