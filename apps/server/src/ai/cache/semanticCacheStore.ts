import { createRagEmbeddings } from '../../rag/langchain/ragEmbeddings.js';

/** 语义缓存条目 */
type SemanticCacheEntry = {
  query: string;
  embedding: number[];
  answer: string;
  hitCount: number;
  expiresAt: number;
};

/** 默认语义相似度阈值 */
const DEFAULT_SIMILARITY_THRESHOLD = 0.95;
/** 默认条目上限 */
const DEFAULT_MAX_ENTRIES = 2000;
/** 默认 TTL */
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 小时

const resolveSimilarityThreshold = (): number => {
  const env = process.env.AI_SEMANTIC_CACHE_THRESHOLD?.trim();
  if (!env) {
    return DEFAULT_SIMILARITY_THRESHOLD;
  }
  const parsed = Number(env);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1 ? parsed : DEFAULT_SIMILARITY_THRESHOLD;
};

const resolveMaxEntries = (): number => {
  const env = process.env.AI_SEMANTIC_CACHE_MAX_ENTRIES?.trim();
  if (!env) {
    return DEFAULT_MAX_ENTRIES;
  }
  const parsed = Number(env);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_ENTRIES;
};

const similarityThreshold = resolveSimilarityThreshold();
const maxEntries = resolveMaxEntries();

/** 环形缓冲区 */
const entries: SemanticCacheEntry[] = [];
let writeIndex = 0;

/** 余弦相似度 */
const cosineSimilarity = (a: number[], b: number[]): number => {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

/** 语义缓存查询：返回最相似答案（相似度 > 阈值），或 null */
export const querySemanticCache = async (query: string): Promise<string | null> => {
  if (entries.length === 0) {
    return null;
  }

  const nowMs = Date.now();
  let queryEmbedding: number[];

  try {
    const embeddings = createRagEmbeddings();
    queryEmbedding = (await embeddings.embedQuery(query)) as number[];
  } catch {
    return null;
  }

  let bestScore = -1;
  let bestEntry: SemanticCacheEntry | null = null;

  for (const entry of entries) {
    if (entry.expiresAt <= nowMs) {
      continue;
    }

    const score = cosineSimilarity(queryEmbedding, entry.embedding);
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  if (!bestEntry || bestScore < similarityThreshold) {
    return null;
  }

  bestEntry.hitCount += 1;
  return bestEntry.answer;
};

/** 写入语义缓存（环形缓冲区覆盖最旧条目） */
export const writeSemanticCache = async (
  query: string,
  answer: string,
  ttlMs = DEFAULT_TTL_MS,
): Promise<void> => {
  let embedding: number[];

  try {
    const embeddings = createRagEmbeddings();
    embedding = (await embeddings.embedQuery(query)) as number[];
  } catch {
    return;
  }

  const entry: SemanticCacheEntry = {
    query,
    embedding,
    answer,
    hitCount: 0,
    expiresAt: Date.now() + ttlMs,
  };

  if (entries.length < maxEntries) {
    entries.push(entry);
  } else {
    entries[writeIndex % maxEntries] = entry;
    writeIndex = (writeIndex + 1) % maxEntries;
  }
};

export const clearSemanticCache = (): void => {
  entries.length = 0;
  writeIndex = 0;
};
