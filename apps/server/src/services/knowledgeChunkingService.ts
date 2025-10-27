import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { getEncoding } from 'js-tiktoken';
import { rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { extname, join } from 'path';
import { extractDocumentText } from './documentTextExtractor.js';
import { parseFileDataUrl } from './fileAnalysisHelpers.js';

export type KnowledgeChunkPreview = {
  id: string;
  index: number;
  text: string;
  tokenCount: number;
  charCount: number;
};

export type KnowledgeDocumentPreprocessingRules = {
  normalizeWhitespace?: boolean;
  removeUrlsEmails?: boolean;
};

export type KnowledgeDocumentChunkOptions = {
  fileName: string;
  fileDataUrl: string;
  mimeType?: string;
  maxTokens?: number;
  chunkOverlap?: number;
  separator?: string;
  segmentMaxLength?: number;
  overlapLength?: number;
  preprocessingRules?: KnowledgeDocumentPreprocessingRules;
};

export type BuiltKnowledgeDocumentChunks = {
  mimeType: string;
  buffer: Buffer;
  processedText: string;
  chunks: KnowledgeChunkPreview[];
};

const GPT2_TOKENIZER = getEncoding('gpt2');
const DEFAULT_SEPARATOR = '\n\n';
const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_CHUNK_OVERLAP = 80;
const FALLBACK_SEPARATORS = ['\n\n', '\n', '。', '！', '？', '；', '，', ' ', ''];

export const estimateTokenCount = (text: string) => {
  if (!text) {
    return 0;
  }

  return GPT2_TOKENIZER.encode(text).length;
};

const decodeSegmentSeparator = (separator?: string) => {
  if (!separator) {
    return DEFAULT_SEPARATOR;
  }

  return separator
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');
};

const buildRecursiveSeparators = (separator?: string) => {
  const primary = decodeSegmentSeparator(separator);
  return [...new Set([
    primary,
    ...FALLBACK_SEPARATORS,
  ])];
};

const clampChunkOverlap = (chunkSize: number, overlap: number) => {
  if (chunkSize <= 1) {
    return 0;
  }

  return Math.min(Math.max(0, overlap), chunkSize - 1);
};

class NaturalBoundaryRecursiveCharacterTextSplitter extends RecursiveCharacterTextSplitter {
  protected splitOnSeparator(text: string, separator: string): string[] {
    if (!separator) {
      return super.splitOnSeparator(text, separator);
    }

    const segments = text.split(separator);
    return segments
      .map((segment, index) => (
        index < segments.length - 1 ? `${segment}${separator}` : segment
      ))
      .filter((segment) => segment !== '');
  }

  async mergeSplits(splits: string[], separator: string): Promise<string[]> {
    if (separator) {
      return splits
        .map((split) => split.trim())
        .filter(Boolean);
    }

    return super.mergeSplits(splits, separator);
  }
}

export const preprocessDocumentText = (text: string, rules?: KnowledgeDocumentPreprocessingRules) => {
  let nextText = text.replace(/\r\n/g, '\n');

  if (rules?.removeUrlsEmails) {
    nextText = nextText
      .replace(/https?:\/\/\S+/gi, ' ')
      .replace(/www\.\S+/gi, ' ')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ');
  }

  if (rules?.normalizeWhitespace) {
    nextText = nextText
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map((line) => line.trim())
      .join('\n');
  }

  return nextText.trim();
};

export const splitTextToChunks = async (params: {
  text: string;
  separator?: string;
  maxTokens?: number;
  chunkOverlap?: number;
  segmentMaxLength?: number;
  overlapLength?: number;
}): Promise<KnowledgeChunkPreview[]> => {
  const normalized = params.text.replace(/\r\n/g, '\n').trim();

  if (!normalized) {
    return [];
  }

  const useCharacterCompatibilityMode = typeof params.segmentMaxLength === 'number';
  const rawChunkSize = useCharacterCompatibilityMode
    ? Math.max(1, params.segmentMaxLength ?? 1)
    : Math.max(1, params.maxTokens ?? DEFAULT_MAX_TOKENS);
  const rawChunkOverlap = useCharacterCompatibilityMode
    ? Math.max(0, params.overlapLength ?? (params.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP) * 4)
    : Math.max(0, params.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP);

  const splitter = new NaturalBoundaryRecursiveCharacterTextSplitter({
    chunkSize: rawChunkSize,
    chunkOverlap: clampChunkOverlap(rawChunkSize, rawChunkOverlap),
    separators: buildRecursiveSeparators(params.separator),
    lengthFunction: useCharacterCompatibilityMode
      ? (text: string) => text.length
      : estimateTokenCount,
  });

  const splitValues = await splitter.splitText(normalized);

  return splitValues
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value, index) => ({
      id: `chunk_${index}`,
      index,
      text: value,
      charCount: value.length,
      tokenCount: estimateTokenCount(value),
    }));
};

export const buildKnowledgeDocumentChunks = async (
  params: KnowledgeDocumentChunkOptions,
): Promise<BuiltKnowledgeDocumentChunks> => {
  const parsedPayload = parseFileDataUrl(params.fileDataUrl);
  const mimeType = params.mimeType?.trim() || parsedPayload.mimeType;
  const extension = extname(params.fileName).replace(/^\./, '').toLowerCase();
  const tempImportPath = join(tmpdir(), `kronos-preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension || 'bin'}`);

  await writeFile(tempImportPath, parsedPayload.buffer);

  try {
    const extractedText = await extractDocumentText({
      buffer: parsedPayload.buffer,
      mimeType,
      fileName: params.fileName,
      filePath: tempImportPath,
    });

    const processedText = preprocessDocumentText(extractedText, params.preprocessingRules);
    if (!processedText) {
      throw new Error('文件内容为空或暂无法提取文本');
    }

    const chunks = await splitTextToChunks({
      text: processedText,
      separator: params.separator,
      maxTokens: params.maxTokens,
      chunkOverlap: params.chunkOverlap,
      segmentMaxLength: params.segmentMaxLength,
      overlapLength: params.overlapLength,
    });

    return {
      mimeType,
      buffer: parsedPayload.buffer,
      processedText,
      chunks,
    };
  } finally {
    await rm(tempImportPath, { force: true });
  }
};
