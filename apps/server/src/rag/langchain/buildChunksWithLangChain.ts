import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import type { KnowledgeChunkPreview, KnowledgeDocumentChunkOptions } from '../../services/knowledgeChunkingService.js';
import {
  decodeSegmentSeparator,
  estimateTokenCount,
  extractPreprocessedKnowledgeDocument,
  type BuiltKnowledgeDocumentChunks,
} from '../../services/knowledgeChunkingService.js';

const buildSplitterSeparators = (primary: string): string[] => {
  const defaults = ['\n\n', '\n', ' ', ''];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const sep of [primary, ...defaults]) {
    if (!seen.has(sep)) {
      seen.add(sep);
      out.push(sep);
    }
  }
  return out;
};

/** LangChain `RecursiveCharacterTextSplitter` + 与自研一致的解析/预处理；落盘仍用现有 jsonl。多查询改写见 `expandRetrievalQueries.ts`。 */
export async function buildKnowledgeDocumentChunksWithLangChain(
  params: KnowledgeDocumentChunkOptions,
): Promise<BuiltKnowledgeDocumentChunks> {
  const { mimeType, buffer, processedText } = await extractPreprocessedKnowledgeDocument(params);
  const maxChars = Math.max(200, params.segmentMaxLength ?? (params.maxTokens ?? 500) * 4);
  const overlapChars = Math.max(0, params.overlapLength ?? (params.chunkOverlap ?? 80) * 4);
  const safeOverlap = Math.min(overlapChars, Math.max(0, maxChars - 1));
  const primarySep = decodeSegmentSeparator(params.separator);
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: maxChars,
    chunkOverlap: safeOverlap,
    separators: buildSplitterSeparators(primarySep),
    keepSeparator: false,
  });

  const pieces = await splitter.splitText(processedText);
  const chunks: KnowledgeChunkPreview[] = pieces
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: `chunk_${index}`,
      index,
      text,
      charCount: text.length,
      tokenCount: estimateTokenCount(text),
    }));

  return {
    mimeType,
    buffer,
    processedText,
    chunks,
  };
}
