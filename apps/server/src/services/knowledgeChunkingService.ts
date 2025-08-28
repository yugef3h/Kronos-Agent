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

export const estimateTokenCount = (text: string) => {
  return Math.max(1, Math.ceil(text.length / 4));
};

const decodeSegmentSeparator = (separator?: string) => {
  if (!separator) {
    return '\n\n';
  }

  return separator
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');
};

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

export const splitTextToChunks = (params: {
  text: string;
  separator?: string;
  maxTokens?: number;
  chunkOverlap?: number;
  segmentMaxLength?: number;
  overlapLength?: number;
}): KnowledgeChunkPreview[] => {
  const maxChars = Math.max(200, params.segmentMaxLength ?? (params.maxTokens ?? 500) * 4);
  const overlapChars = Math.max(0, params.overlapLength ?? (params.chunkOverlap ?? 80) * 4);
  const normalized = params.text.replace(/\r\n/g, '\n').trim();
  const separator = decodeSegmentSeparator(params.separator);

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);

  const chunks: KnowledgeChunkPreview[] = [];
  let current = '';

  const pushChunk = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    chunks.push({
      id: `chunk_${chunks.length}`,
      index: chunks.length,
      text: trimmed,
      charCount: trimmed.length,
      tokenCount: estimateTokenCount(trimmed),
    });
  };

  paragraphs.forEach((paragraph) => {
    if (paragraph.length > maxChars) {
      if (current) {
        pushChunk(current);
        current = '';
      }

      let start = 0;
      while (start < paragraph.length) {
        const end = Math.min(start + maxChars, paragraph.length);
        pushChunk(paragraph.slice(start, end));
        if (end >= paragraph.length) {
          break;
        }
        start = Math.max(end - overlapChars, start + 1);
      }
      return;
    }

    const nextValue = current ? `${current}${separator}${paragraph}` : paragraph;
    if (nextValue.length > maxChars) {
      pushChunk(current);
      current = paragraph;
      return;
    }

    current = nextValue;
  });

  if (current) {
    pushChunk(current);
  }

  return chunks.map((chunk, index) => ({
    ...chunk,
    id: `chunk_${index}`,
    index,
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

    const chunks = splitTextToChunks({
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