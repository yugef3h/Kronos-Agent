import { getKnowledgeDatasetById } from '../domain/knowledgeDatasetStore.js';
import {
  buildKnowledgeDocumentChunks,
  estimateTokenCount,
  splitTextToChunks,
  type KnowledgeChunkPreview,
  type KnowledgeDocumentPreprocessingRules,
} from './knowledgeChunkingService.js';

type IndexingEstimatePreProcessingRule = {
  id: string;
  enabled: boolean;
};

type IndexingEstimateSegmentationRule = {
  separator: string;
  max_tokens: number;
  chunk_overlap?: number;
  segment_max_length?: number;
  overlap_length?: number;
};

type IndexingEstimateFileInput = {
  file_id?: string;
  file_name: string;
  file_data_url: string;
  mime_type?: string;
};

export type DatasetIndexingEstimatePayload = {
  dataset_id: string;
  doc_form: 'text_model' | 'qa_model' | 'hierarchical_model';
  doc_language: string;
  process_rule: {
    mode: 'custom' | 'hierarchical';
    rules: {
      pre_processing_rules: IndexingEstimatePreProcessingRule[];
      segmentation: IndexingEstimateSegmentationRule;
      parent_mode: 'full-doc' | 'paragraph';
      subchunk_segmentation: IndexingEstimateSegmentationRule;
    };
    summary_index_setting?: {
      enable?: boolean;
      model_name?: string;
      model_provider_name?: string;
      summary_prompt?: string;
    };
  };
  summary_index_setting?: {
    enable?: boolean;
    model_name?: string;
    model_provider_name?: string;
    summary_prompt?: string;
  };
  info_list?: {
    data_source_type: 'upload_file';
    file_info_list?: {
      file_ids?: string[];
      files?: IndexingEstimateFileInput[];
    };
  };
};

export type DatasetIndexingEstimatePreviewItem = {
  content: string;
  child_chunks: string[];
  summary?: string;
};

export type DatasetIndexingEstimateQaItem = {
  question: string;
  answer: string;
};

export type DatasetIndexingEstimateResponse = {
  total_nodes: number;
  tokens: number;
  total_price: number;
  currency: string;
  total_segments: number;
  preview: DatasetIndexingEstimatePreviewItem[];
  qa_preview?: DatasetIndexingEstimateQaItem[];
};

const DEFAULT_CURRENCY = 'USD';
const DEFAULT_EMBEDDING_PRICE_PER_1K = 0;
export const DRAFT_KNOWLEDGE_DATASET_ID = '__draft_preview__';

const toPreprocessingRules = (
  rules: IndexingEstimatePreProcessingRule[],
): KnowledgeDocumentPreprocessingRules => {
  const enabledRuleIds = new Set(
    rules
      .filter((rule) => rule.enabled)
      .map((rule) => rule.id),
  );

  return {
    normalizeWhitespace: enabledRuleIds.has('remove_extra_spaces'),
    removeUrlsEmails: enabledRuleIds.has('remove_urls_emails'),
  };
};

const buildLeafChunkSummary = (chunks: KnowledgeChunkPreview[]) => {
  return chunks.reduce(
    (accumulator, chunk) => ({
      tokens: accumulator.tokens + chunk.tokenCount,
      segments: accumulator.segments + 1,
    }),
    { tokens: 0, segments: 0 },
  );
};

const buildParentChunks = (params: {
  processedText: string;
  parentMode: 'full-doc' | 'paragraph';
  segmentation: IndexingEstimateSegmentationRule;
}) => {
  if (params.parentMode === 'full-doc') {
    return [{
      id: 'parent_0',
      index: 0,
      text: params.processedText,
      tokenCount: estimateTokenCount(params.processedText),
      charCount: params.processedText.length,
    } satisfies KnowledgeChunkPreview];
  }

  return splitTextToChunks({
    text: params.processedText,
    separator: params.segmentation.separator,
    maxTokens: params.segmentation.max_tokens,
    chunkOverlap: params.segmentation.chunk_overlap,
  });
};

const extractInlineFiles = (payload: DatasetIndexingEstimatePayload) => {
  const infoList = payload.info_list;
  if (!infoList || infoList.data_source_type !== 'upload_file') {
    throw new Error('UNSUPPORTED_DATA_SOURCE_TYPE');
  }

  const files = infoList.file_info_list?.files ?? [];
  if (files.length > 0) {
    return files;
  }

  if ((infoList.file_info_list?.file_ids?.length ?? 0) > 0) {
    throw new Error('UNSUPPORTED_FILE_REFERENCE_MODE');
  }

  throw new Error('MISSING_UPLOAD_FILES');
};

export const runKnowledgeIndexingEstimate = async (
  payload: DatasetIndexingEstimatePayload,
): Promise<DatasetIndexingEstimateResponse> => {
  if (payload.dataset_id !== DRAFT_KNOWLEDGE_DATASET_ID) {
    const dataset = await getKnowledgeDatasetById(payload.dataset_id);
    if (!dataset) {
      throw new Error('KNOWLEDGE_DATASET_NOT_FOUND');
    }
  }

  if (payload.doc_form === 'qa_model') {
    throw new Error('QA_MODEL_NOT_SUPPORTED');
  }

  const files = extractInlineFiles(payload);
  const preprocessingRules = toPreprocessingRules(payload.process_rule.rules.pre_processing_rules);
  const segmentation = payload.process_rule.rules.segmentation;
  const subchunkSegmentation = payload.process_rule.rules.subchunk_segmentation;

  const preview: DatasetIndexingEstimatePreviewItem[] = [];
  let tokens = 0;
  let totalSegments = 0;

  // 配置透传给统一的切分服务
  for (const file of files) {
    const chunkResult = await buildKnowledgeDocumentChunks({
      fileName: file.file_name,
      fileDataUrl: file.file_data_url,
      mimeType: file.mime_type,
      maxTokens: segmentation.max_tokens,
      chunkOverlap: segmentation.chunk_overlap,
      separator: segmentation.separator,
      segmentMaxLength: segmentation.segment_max_length,
      overlapLength: segmentation.overlap_length,
      preprocessingRules,
    });

    if (payload.doc_form === 'hierarchical_model') {
      const parentChunks = buildParentChunks({
        processedText: chunkResult.processedText,
        parentMode: payload.process_rule.rules.parent_mode,
        segmentation,
      });

      parentChunks.forEach((parentChunk) => {
        const childChunks = splitTextToChunks({
          text: parentChunk.text,
          separator: subchunkSegmentation.separator,
          maxTokens: subchunkSegmentation.max_tokens,
          chunkOverlap: subchunkSegmentation.chunk_overlap,
          segmentMaxLength: subchunkSegmentation.segment_max_length,
          overlapLength: subchunkSegmentation.overlap_length,
        });

        const leafSummary = buildLeafChunkSummary(childChunks);
        tokens += leafSummary.tokens || parentChunk.tokenCount;
        totalSegments += leafSummary.segments || 1;
        preview.push({
          content: parentChunk.text,
          child_chunks: childChunks.map((chunk) => chunk.text),
        });
      });

      continue;
    }

    const flatSummary = buildLeafChunkSummary(chunkResult.chunks);
    tokens += flatSummary.tokens;
    totalSegments += flatSummary.segments;
    preview.push(...chunkResult.chunks.map((chunk) => ({
      content: chunk.text,
      child_chunks: [],
    })));
  }

  return {
    total_nodes: files.length,
    tokens,
    total_price: Number(((tokens / 1000) * DEFAULT_EMBEDDING_PRICE_PER_1K).toFixed(6)),
    currency: DEFAULT_CURRENCY,
    total_segments: totalSegments,
    preview,
  };
};