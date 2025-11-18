import { z } from 'zod';

/** 知识库 REST 请求体验证与 DTO（与 `chatRoutes` 契约一致；`langchain_query_variants` 为响应诊断可选字段）。 */

const knowledgeMetadataFieldSchema = z.object({
  key: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(40),
});

const knowledgeSegmentationRuleSchema = z.object({
  separator: z.string().min(1).max(24).default('\n\n'),
  max_tokens: z.coerce.number().int().min(50).max(4000).default(500),
  chunk_overlap: z.coerce.number().int().min(0).max(1000).default(80),
  segment_max_length: z.coerce.number().int().min(50).max(12000).optional(),
  overlap_length: z.coerce.number().int().min(0).max(4000).optional(),
});

const knowledgeRetrievalWeightsSchema = z.object({
  semantic: z.coerce.number().min(0).max(1).default(1),
  keyword: z.coerce.number().min(0).max(1).default(0),
  full_text: z.coerce.number().min(0).max(1).default(0),
}).default({
  semantic: 1,
  keyword: 0,
  full_text: 0,
});

const knowledgeRetrievalModelSchema = z.object({
  search_method: z.enum(['semantic_search', 'full_text_search', 'keyword_search', 'hybrid_search']).default('semantic_search'),
  top_k: z.coerce.number().int().min(1).max(20).default(5),
  score_threshold_enabled: z.boolean().default(false),
  score_threshold: z.coerce.number().min(0).max(1).nullable().default(null),
  reranking_enable: z.boolean().default(false),
  reranking_model: z.string().trim().min(1).max(120).optional(),
  reranking_mode: z.enum(['weighted_score', 'model_rerank']).default('weighted_score'),
  weights: knowledgeRetrievalWeightsSchema,
}).default({
  search_method: 'semantic_search',
  top_k: 5,
  score_threshold_enabled: false,
  score_threshold: null,
  reranking_enable: false,
  reranking_mode: 'weighted_score',
  weights: {
    semantic: 1,
    keyword: 0,
    full_text: 0,
  },
});

const knowledgeProcessRuleSchema = z.object({
  mode: z.enum(['custom', 'hierarchical', 'automatic']).default('custom'),
  rules: z.object({
    pre_processing_rules: z.array(z.object({
      id: z.string().trim().min(1).max(60),
      enabled: z.boolean().default(true),
    })).max(20).default([]),
    segmentation: knowledgeSegmentationRuleSchema,
    parent_mode: z.enum(['full-doc', 'paragraph']).default('paragraph'),
    subchunk_segmentation: knowledgeSegmentationRuleSchema.default({
      separator: '\n',
      max_tokens: 200,
      chunk_overlap: 30,
      segment_max_length: 512,
      overlap_length: 25,
    }),
  }),
}).default({
  mode: 'custom',
  rules: {
    pre_processing_rules: [
      { id: 'remove_extra_spaces', enabled: true },
      { id: 'remove_urls_emails', enabled: false },
    ],
    segmentation: {
      separator: '\n\n',
      max_tokens: 500,
      chunk_overlap: 80,
      segment_max_length: 1024,
      overlap_length: 50,
    },
    parent_mode: 'paragraph',
    subchunk_segmentation: {
      separator: '\n',
      max_tokens: 200,
      chunk_overlap: 30,
      segment_max_length: 512,
      overlap_length: 25,
    },
  },
});

const knowledgeSummaryIndexSettingSchema = z.object({
  enable: z.boolean().default(false),
  model_name: z.string().trim().min(1).max(120).optional(),
  model_provider_name: z.string().trim().min(1).max(120).optional(),
  summary_prompt: z.string().trim().min(1).max(4000).optional(),
}).default({
  enable: false,
});

export const knowledgeDatasetInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(240).default(''),
  is_multimodal: z.boolean().default(false),
  doc_metadata: z.array(knowledgeMetadataFieldSchema).max(12).default([]),
  indexing_technique: z.enum(['economy', 'high_quality']).default('high_quality'),
  embedding_model: z.string().trim().min(1).max(120).default('default-embedding'),
  embedding_model_provider: z.string().trim().min(1).max(120).default('default'),
  retrieval_model: knowledgeRetrievalModelSchema,
  process_rule: knowledgeProcessRuleSchema,
  summary_index_setting: knowledgeSummaryIndexSettingSchema,
  doc_form: z.enum(['text_model', 'qa_model', 'hierarchical_model']).default('text_model'),
  doc_language: z.string().trim().min(1).max(80).default('Chinese Simplified'),
});

export const knowledgeDocumentImportSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  fileDataUrl: z.string().min(1),
  mimeType: z.string().trim().max(120).optional(),
  maxTokens: z.coerce.number().int().min(100).max(4000).default(500),
  chunkOverlap: z.coerce.number().int().min(0).max(1000).default(80),
  separator: z.string().min(1).max(24).default('\\n\\n'),
  segmentMaxLength: z.coerce.number().int().min(100).max(12000).default(1024),
  overlapLength: z.coerce.number().int().min(0).max(4000).default(50),
  preprocessingRules: z.object({
    normalizeWhitespace: z.boolean().default(true),
    removeUrlsEmails: z.boolean().default(false),
  }).default({
    normalizeWhitespace: true,
    removeUrlsEmails: false,
  }),
  metadata: z.record(z.string().trim().min(1).max(240)).default({}),
});

export const knowledgeDocumentKeywordsUpdateSchema = z.object({
  keywords: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
});

export const knowledgeDocumentPreviewSchema = z.object({
  inputs: z.array(knowledgeDocumentImportSchema).min(1).max(30),
  previewLimit: z.coerce.number().int().min(1).max(100).default(40),
});

export const knowledgeRetrievalQuerySchema = z.object({
  query: z.string().trim().min(1).max(4000),
  dataset_ids: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  retrieval_mode: z.enum(['oneWay', 'multiWay']).default('multiWay'),
  single_retrieval_config: z.object({
    model: z.string().trim().min(1).max(120).default('default-vector'),
    top_k: z.coerce.number().int().min(1).max(20).default(3),
    score_threshold: z.coerce.number().min(0).max(1).nullable().default(null),
  }).default({
    model: 'default-vector',
    top_k: 3,
    score_threshold: null,
  }),
  multiple_retrieval_config: z.object({
    top_k: z.coerce.number().int().min(1).max(20).default(5),
    score_threshold: z.coerce.number().min(0).max(1).nullable().default(null),
    reranking_enable: z.boolean().default(false),
    reranking_model: z.string().trim().min(1).max(120).optional(),
  }).default({
    top_k: 5,
    score_threshold: null,
    reranking_enable: false,
  }),
  metadata_filtering_mode: z.enum(['disabled', 'manual']).default('disabled'),
  metadata_filtering_conditions: z.array(z.object({
    id: z.string().trim().min(1).max(120).optional(),
    field: z.string().trim().min(1).max(80),
    operator: z.enum(['contains', 'equals', 'not_equals']).default('contains'),
    value: z.string().trim().min(1).max(240),
  })).max(20).default([]),
});

const indexingEstimateFileSchema = z.object({
  file_id: z.string().trim().min(1).max(120).optional(),
  file_name: z.string().trim().min(1).max(240),
  file_data_url: z.string().min(1),
  mime_type: z.string().trim().max(120).optional(),
});

const indexingEstimateSegmentationSchema = z.object({
  separator: z.string().min(1).max(24).default('\n\n'),
  max_tokens: z.coerce.number().int().min(100).max(4000).default(500),
  chunk_overlap: z.coerce.number().int().min(0).max(1000).default(80).optional(),
  segment_max_length: z.coerce.number().int().min(100).max(12000).optional(),
  overlap_length: z.coerce.number().int().min(0).max(4000).optional(),
});

export const indexingEstimateSchema = z.object({
  dataset_id: z.string().trim().min(1),
  doc_form: z.enum(['text_model', 'qa_model', 'hierarchical_model']).default('text_model'),
  doc_language: z.string().trim().min(1).max(80).default('Chinese Simplified'),
  process_rule: z.object({
    mode: z.enum(['custom', 'hierarchical']).default('custom'),
    rules: z.object({
      pre_processing_rules: z.array(z.object({
        id: z.string().trim().min(1).max(60),
        enabled: z.boolean().default(true),
      })).max(20).default([]),
      segmentation: indexingEstimateSegmentationSchema,
      parent_mode: z.enum(['full-doc', 'paragraph']).default('paragraph'),
      subchunk_segmentation: z.object({
        separator: z.string().min(1).max(24).default('\n'),
        max_tokens: z.coerce.number().int().min(50).max(2000).default(200),
        chunk_overlap: z.coerce.number().int().min(0).max(500).default(30).optional(),
        segment_max_length: z.coerce.number().int().min(50).max(6000).optional(),
        overlap_length: z.coerce.number().int().min(0).max(2000).optional(),
      }).default({
        separator: '\n',
        max_tokens: 200,
        chunk_overlap: 30,
      }),
    }),
    summary_index_setting: z.object({
      enable: z.boolean().optional(),
      model_name: z.string().trim().min(1).max(120).optional(),
      model_provider_name: z.string().trim().min(1).max(120).optional(),
      summary_prompt: z.string().trim().min(1).max(4000).optional(),
    }).optional(),
  }),
  summary_index_setting: z.object({
    enable: z.boolean().optional(),
    model_name: z.string().trim().min(1).max(120).optional(),
    model_provider_name: z.string().trim().min(1).max(120).optional(),
    summary_prompt: z.string().trim().min(1).max(4000).optional(),
  }).optional(),
  info_list: z.object({
    data_source_type: z.literal('upload_file'),
    file_info_list: z.object({
      file_ids: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
      files: z.array(indexingEstimateFileSchema).min(1).max(30).optional(),
    }).refine((value) => (value.files?.length ?? 0) > 0 || (value.file_ids?.length ?? 0) > 0, {
      message: 'At least one file is required',
    }),
  }),
});

export type KnowledgeDatasetInput = z.infer<typeof knowledgeDatasetInputSchema>;
export type KnowledgeDocumentImportBody = z.infer<typeof knowledgeDocumentImportSchema>;
export type KnowledgeDocumentKeywordsUpdateBody = z.infer<typeof knowledgeDocumentKeywordsUpdateSchema>;
export type KnowledgeDocumentPreviewBody = z.infer<typeof knowledgeDocumentPreviewSchema>;
export type KnowledgeRetrievalQueryBody = z.infer<typeof knowledgeRetrievalQuerySchema>;
export type KnowledgeIndexingEstimateBody = z.infer<typeof indexingEstimateSchema>;
