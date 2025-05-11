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
  attentionTokenLimit?: number;
};

const SUPPORTED_TOKENIZERS = ['cl100k_base', 'p50k_base'] as const;
type SupportedTokenizer = (typeof SUPPORTED_TOKENIZERS)[number];

const DEFAULT_ATTENTION_TOKEN_LIMIT = 24;

export type AttentionAssociation = {
  mode: 'embedding_similarity';
  tokenLimit: number;
  embeddingSource: 'doubao' | 'fallback' | 'python-service';
  matrix: number[][];
  note: string;
};

type PythonAttentionResponse = {
  matrix: number[][];
};

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

const softmax = (values: number[]): number[] => {
  const max = Math.max(...values);
  const exps = values.map((value) => Math.exp(value - max));
  const sum = exps.reduce((acc, value) => acc + value, 0) || 1;
  return exps.map((value) => value / sum);
};

const buildCausalAssociationMatrix = (vectors: number[][]): number[][] => {
  return vectors.map((queryVector, queryIndex) => {
    const logits = vectors.map((keyVector, keyIndex) => {
      if (keyIndex > queryIndex) {
        return Number.NEGATIVE_INFINITY;
      }

      const similarity = cosineSimilarity(queryVector, keyVector);
      const distanceBias = Math.exp(-(queryIndex - keyIndex) / 6);
      return 1.6 * similarity + 0.8 * distanceBias;
    });

    const validValues = logits.map((value) => (Number.isFinite(value) ? value : -1e9));
    const weights = softmax(validValues);

    return weights.map((weight, index) => (index > queryIndex ? 0 : Number(weight.toFixed(4))));
  });
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

const sanitizeTokenForEmbedding = (tokenText: string): string => {
  if (tokenText.length === 0) {
    return '[EMPTY]';
  }

  if (tokenText.trim().length === 0) {
    return `[WS:${tokenText.length}]`;
  }

  return tokenText;
};

const requestPythonAttentionMatrix = async (tokens: string[]): Promise<number[][] | null> => {
  if (!env.ATTENTION_PY_ENABLED || tokens.length === 0) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.ATTENTION_PY_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.ATTENTION_PY_BASE_URL}/attention/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokens,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as PythonAttentionResponse;

    if (!Array.isArray(payload.matrix) || payload.matrix.length === 0) {
      return null;
    }

    return payload.matrix.map((row, queryIndex) =>
      row.map((value, keyIndex) => {
        if (keyIndex > queryIndex) {
          return 0;
        }

        const normalized = Number.isFinite(value) ? Math.max(0, value) : 0;
        return Number(normalized.toFixed(4));
      }),
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
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

  const attentionTokenLimit = Math.max(8, Math.min(params.attentionTokenLimit ?? DEFAULT_ATTENTION_TOKEN_LIMIT, 64));
  const attentionTokens = tokens.slice(0, attentionTokenLimit);
  const tokenTextsForEmbedding = attentionTokens.map((token) => sanitizeTokenForEmbedding(token.tokenText));

  const pythonMatrix = await requestPythonAttentionMatrix(tokenTextsForEmbedding);
  let attentionAssociation: AttentionAssociation;

  if (pythonMatrix) {
    attentionAssociation = {
      mode: 'embedding_similarity',
      tokenLimit: attentionTokens.length,
      embeddingSource: 'python-service',
      matrix: pythonMatrix,
      note: 'Python 微服务 attention（环境变量 ATTENTION_PY_ENABLED=true 时启用）。',
    };
  } else {
    const tokenEmbedding = await embedChunks(tokenTextsForEmbedding, embeddingModel);
    attentionAssociation = {
      mode: 'embedding_similarity',
      tokenLimit: attentionTokens.length,
      embeddingSource: tokenEmbedding.embeddingSource,
      matrix: buildCausalAssociationMatrix(tokenEmbedding.vectors),
      note: env.ATTENTION_PY_ENABLED
        ? 'Python 微服务不可用，已回退为当前版本（embedding 相似度关联）。'
        : '当前版本（embedding 相似度关联）；如需 Python 微服务请设置 ATTENTION_PY_ENABLED=true。',
    };
  }

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
    attentionAssociation,
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
