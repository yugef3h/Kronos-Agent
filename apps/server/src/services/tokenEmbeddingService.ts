import { OpenAIEmbeddings } from '@langchain/openai';
import { getEncoding } from 'js-tiktoken';
import { env } from '../config/env.js';
import { type ProjectionMethod, projectVectorsTo2D } from './vectorProjection.js';

export type TokenRow = {
  index: number;
  tokenId: number;
  tokenText: string;
  start: number;
  end: number;
};

export type EmbeddingProjectionPoint = {
  label: string;
  chunkText: string;
  x: number;
  y: number;
  norm: number;
};

export type AnalyzeTokenAndEmbeddingParams = {
  text: string;
  maxChunkSize: number;
  projectionMethod: ProjectionMethod;
  secondaryTokenizer?: string;
  secondaryEmbeddingModel?: string;
};

const SUPPORTED_TOKENIZERS = ['cl100k_base', 'p50k_base'] as const;
type SupportedTokenizer = (typeof SUPPORTED_TOKENIZERS)[number];

const estimateOffsets = (sourceText: string, tokenTexts: string[]): Array<{ start: number; end: number }> => {
  const offsets: Array<{ start: number; end: number }> = [];
  let cursor = 0;

  for (const tokenText of tokenTexts) {
    // 通过游标向前推进，尽量保证重复 token 文本时的匹配稳定性。
    const nextIndex = sourceText.indexOf(tokenText, cursor);

    if (nextIndex === -1) {
      offsets.push({ start: cursor, end: cursor + tokenText.length });
      cursor += tokenText.length;
      continue;
    }

    offsets.push({ start: nextIndex, end: nextIndex + tokenText.length });
    cursor = nextIndex + tokenText.length;
  }

  return offsets;
};

const chunkTextByLength = (sourceText: string, maxChunkSize: number): string[] => {
  const chunks: string[] = [];

  for (let i = 0; i < sourceText.length; i += maxChunkSize) {
    chunks.push(sourceText.slice(i, i + maxChunkSize));
  }

  return chunks.filter((chunk) => chunk.trim().length > 0);
};

const fallbackEmbeddings = (chunks: string[], dimensions = 24): number[][] => {
  return chunks.map((chunk) => {
    const vector = Array.from({ length: dimensions }, () => 0);

    for (let i = 0; i < chunk.length; i += 1) {
      const code = chunk.charCodeAt(i);
      vector[i % dimensions] += code / 255;
    }

    return vector;
  });
};

const sanitizeTokenizer = (value?: string): SupportedTokenizer => {
  if (!value) {
    return 'cl100k_base';
  }

  if (SUPPORTED_TOKENIZERS.includes(value as SupportedTokenizer)) {
    return value as SupportedTokenizer;
  }

  return 'cl100k_base';
};

const tokenizeText = (text: string, tokenizerName: SupportedTokenizer): TokenRow[] => {
  const tokenizer = getEncoding(tokenizerName);
  const tokenIds = tokenizer.encode(text);
  const tokenTexts = tokenIds.map((tokenId) => tokenizer.decode([tokenId]));
  const offsets = estimateOffsets(text, tokenTexts);

  return tokenIds.map((tokenId, index) => ({
    index,
    tokenId,
    tokenText: tokenTexts[index],
    start: offsets[index]?.start ?? 0,
    end: offsets[index]?.end ?? 0,
  }));
};

const cosineSimilarity = (a: number[], b: number[]): number => {
  const dimension = Math.min(a.length, b.length);
  let numerator = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < dimension; i += 1) {
    numerator += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (!denominator) {
    return 0;
  }

  return numerator / denominator;
};

const getTopKNeighborIndices = (vectors: number[][], sourceIndex: number, topK: number): number[] => {
  const source = vectors[sourceIndex];
  const scores: Array<{ index: number; score: number }> = [];

  for (let i = 0; i < vectors.length; i += 1) {
    if (i === sourceIndex) {
      continue;
    }

    scores.push({
      index: i,
      score: cosineSimilarity(source, vectors[i]),
    });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topK).map((item) => item.index);
};

const calculateNeighborhoodAgreement = (left: number[][], right: number[][], topK = 3): number => {
  const size = Math.min(left.length, right.length);
  if (size <= 1) {
    return 1;
  }

  let overlapTotal = 0;
  let compared = 0;

  for (let i = 0; i < size; i += 1) {
    // 比较两组向量在同一 chunk 上的 Top-K 邻居重合度，衡量结构相似性。
    const leftTop = new Set(getTopKNeighborIndices(left, i, topK));
    const rightTop = getTopKNeighborIndices(right, i, topK);

    const overlap = rightTop.reduce((acc, index) => (leftTop.has(index) ? acc + 1 : acc), 0);
    overlapTotal += overlap / topK;
    compared += 1;
  }

  return Number((overlapTotal / compared).toFixed(4));
};

const calculateTokenOverlapRatio = (left: TokenRow[], right: TokenRow[]): number => {
  if (!left.length || !right.length) {
    return 0;
  }

  const leftSet = new Set(left.map((item) => item.tokenText));
  const rightSet = new Set(right.map((item) => item.tokenText));
  let overlap = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) {
      overlap += 1;
    }
  }

  const denominator = Math.max(leftSet.size, rightSet.size) || 1;
  return Number((overlap / denominator).toFixed(4));
};

const embedChunks = async (chunks: string[], embeddingModel: string) => {
  let vectors: number[][] = [];
  let embeddingSource: 'doubao' | 'fallback' = 'doubao';

  try {
    const embeddings = new OpenAIEmbeddings({
      model: embeddingModel,
      apiKey: env.DOUBAO_API_KEY,
      configuration: {
        baseURL: env.DOUBAO_BASE_URL,
      },
    });

    vectors = await embeddings.embedDocuments(chunks);
  } catch {
    // 远端 embedding 不可用时回退本地向量，保障可视化链路不断。
    embeddingSource = 'fallback';
    vectors = fallbackEmbeddings(chunks);
  }

  return { vectors, embeddingSource };
};

export const analyzeTokenAndEmbedding = async (params: AnalyzeTokenAndEmbeddingParams) => {
  // 主分词器固定为 cl100k_base；对比分词器可切换用于差异观察。
  const tokenizerName = sanitizeTokenizer('cl100k_base');
  const secondaryTokenizerName = sanitizeTokenizer(params.secondaryTokenizer);
  const tokens = tokenizeText(params.text, tokenizerName);
  const secondaryTokens = tokenizeText(params.text, secondaryTokenizerName);

  const chunks = chunkTextByLength(params.text, params.maxChunkSize);
  const embeddingModel = env.DOUBAO_EMBEDDING_MODEL || env.DOUBAO_MODEL;
  const secondaryEmbeddingModel = params.secondaryEmbeddingModel || embeddingModel;

  const primaryEmbedding = await embedChunks(chunks, embeddingModel);
  const secondaryEmbedding = await embedChunks(chunks, secondaryEmbeddingModel);

  // 两套 embedding 使用同一种投影算法，保证可视化对比公平。
  const points = await projectVectorsTo2D({
    vectors: primaryEmbedding.vectors,
    method: params.projectionMethod,
  });

  const secondaryPoints = await projectVectorsTo2D({
    vectors: secondaryEmbedding.vectors,
    method: params.projectionMethod,
  });

  const projection: EmbeddingProjectionPoint[] = points.map((point, index) => ({
    label: `chunk_${index + 1}`,
    chunkText: chunks[index],
    x: point.x,
    y: point.y,
    norm: point.norm,
  }));

  const secondaryProjection: EmbeddingProjectionPoint[] = secondaryPoints.map((point, index) => ({
    label: `chunk_${index + 1}`,
    chunkText: chunks[index],
    x: point.x,
    y: point.y,
    norm: point.norm,
  }));

  return {
    tokenizer: tokenizerName,
    embeddingModel,
    embeddingSource: primaryEmbedding.embeddingSource,
    projectionMethod: params.projectionMethod,
    tokenCount: tokens.length,
    chunkCount: chunks.length,
    tokens,
    projection,
    comparison: {
      secondaryTokenizer: secondaryTokenizerName,
      secondaryEmbeddingModel,
      secondaryEmbeddingSource: secondaryEmbedding.embeddingSource,
      secondaryTokenCount: secondaryTokens.length,
      secondaryTokens,
      secondaryProjection,
      tokenOverlapRatio: calculateTokenOverlapRatio(tokens, secondaryTokens),
      neighborhoodAgreement: calculateNeighborhoodAgreement(primaryEmbedding.vectors, secondaryEmbedding.vectors),
    },
  };
};
