import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { createReadStream } from 'fs';
import type { AttachmentMeta } from '../domain/sessionStore.js';
import {
  createKnowledgeDataset,
  deleteKnowledgeDataset,
  listKnowledgeDatasets,
  updateKnowledgeDataset,
} from '../domain/knowledgeDatasetStore.js';
import {
  deleteKnowledgeDatasetFiles,
  getKnowledgeDocumentBlocks,
  importKnowledgeDocument,
  listKnowledgeDocuments,
  previewKnowledgeDocuments,
} from '../domain/knowledgeDocumentStore.js';
import { appendSessionMessages, getSessionSnapshot, listRecentDialogues } from '../domain/sessionStore.js';
import { generateTakeoutCatalog } from '../services/takeoutCatalogService.js';
import { streamChat } from '../services/streamService.js';
import { analyzeTakeoutIntent } from '../services/takeoutIntentService.js';
import { orchestrateTakeoutPrompt } from '../services/takeoutOrchestratorService.js';
import { simulateTakeoutReply } from '../services/takeoutSimulationService.js';
import { analyzeTokenAndEmbedding } from '../services/tokenEmbeddingService.js';
import { recognizeImageByDoubao } from '../services/imageRecognitionService.js';
import { analyzeFileByDoubao } from '../services/fileAnalysisService.js';
import { generateHotTopics } from '../services/hotTopicService.js';
import { runKnowledgeIndexingEstimate } from '../services/knowledgeIndexingEstimateService.js';
import { runKnowledgeRetrievalQuery } from '../services/knowledgeRetrievalService.js';
import { ATTACHMENTS_DIR, loadAttachmentMeta, saveImageAttachment } from '../services/attachmentService.js';
import { join } from 'path';

const chatSchema = z.object({
  prompt: z.string().min(1),
  sessionId: z.string().min(1),
});

const tokenEmbeddingSchema = z.object({
  text: z.string().min(1).max(8000),
  maxChunkSize: z.number().int().min(40).max(500).default(180),
  projectionMethod: z.enum(['random', 'pca', 'umap']).default('pca'),
  attentionTokenLimit: z.number().int().min(8).max(64).default(24),
  secondaryTokenizer: z.enum(['cl100k_base', 'p50k_base']).optional(),
  secondaryEmbeddingModel: z.string().min(1).optional(),
});

const takeoutSimulationSchema = z.object({
  instruction: z.enum(['识别外卖意图', '协议同意回复', '商品选择完成']),
  payload: z.object({
    prompt: z.string().min(1).optional(),
    address: z.string().min(1).optional(),
    discount: z.number().finite().optional(),
  }).optional(),
});

const takeoutIntentSchema = z.object({
  prompt: z.string().min(1),
  history: z.array(z.string()).max(12).optional(),
});

const takeoutOrchestrationSchema = z.object({
  prompt: z.string().min(1),
  history: z.array(z.string()).max(12).optional(),
  sessionId: z.string().min(1).optional(),
});

const takeoutCatalogSchema = z.object({
  prompt: z.string().min(1),
  address: z.string().min(1).optional(),
});

const imageAnalyzeSchema = z.object({
  imageDataUrl: z.string().min(64).max(8_000_000),
  prompt: z.string().max(400).optional(),
  sessionId: z.string().min(1).optional(),
});

const fileAnalyzeSchema = z.object({
  fileDataUrl: z.string().min(1).max(15_000_000),
  fileName: z.string().min(1).max(240),
  mimeType: z.string().min(1).max(120).optional(),
  prompt: z.string().max(400).optional(),
  sessionId: z.string().min(1).optional(),
});

const sessionAppendSchema = z.object({
  sessionId: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(3000),
  })).min(1).max(20),
});

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

const knowledgeDatasetInputSchema = z.object({
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

const knowledgeDocumentImportSchema = z.object({
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

const knowledgeDocumentPreviewSchema = z.object({
  inputs: z.array(knowledgeDocumentImportSchema).min(1).max(30),
  previewLimit: z.coerce.number().int().min(1).max(100).default(40),
});

const knowledgeRetrievalQuerySchema = z.object({
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

const indexingEstimateSchema = z.object({
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

export const chatRoutes = Router();

const sendValidationError = (response: Response, error: z.ZodError) => {
  const flattened = error.flatten();
  const firstFieldError = Object.values(flattened.fieldErrors)
    .flat()
    .find((message): message is string => typeof message === 'string' && Boolean(message.trim()));
  const firstFormError = flattened.formErrors.find((message) => Boolean(message.trim()));

  response.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: firstFieldError || firstFormError || 'Request validation failed',
      formErrors: flattened.formErrors,
      fieldErrors: flattened.fieldErrors,
    },
  });
};

const persistSessionMessagesSafely = (params: {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    attachments?: AttachmentMeta[];
  }>;
}): void => {
  void appendSessionMessages(params).catch((error) => {
    const reason = error instanceof Error ? error.message : 'unknown error';
    console.warn(`[chatRoutes] appendSessionMessages failed: ${reason}`);
  });
};

chatRoutes.post('/chat-stream', async (request: Request, response: Response) => {
  const parsed = chatSchema.safeParse(request.body);

  if (!parsed.success) {
    sendValidationError(response, parsed.error);
    return;
  }

  const lastEventId = Number(request.header('last-event-id') || '0');

  response.setHeader('Content-Type', 'text/event-stream;charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');

  const stream = streamChat({
    prompt: parsed.data.prompt,
    sessionId: parsed.data.sessionId,
    lastEventId,
  });

  try {
    for await (const chunk of stream) {
      response.write(chunk);
    }

    response.end();
  } catch {
    response.end();
  }
});

chatRoutes.get('/session/:sessionId', (request: Request, response: Response) => {
  const sessionId = String(request.params.sessionId || '');
  response.json(getSessionSnapshot(sessionId));
});

chatRoutes.get('/sessions/recent', async (request: Request, response: Response) => {
  const limitParam = Number(request.query.limit || 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.floor(limitParam), 1), 50) : 10;

  const items = await listRecentDialogues(limit);
  response.json({ items });
});

chatRoutes.get('/workflow/knowledge-datasets', async (_request: Request, response: Response) => {
  try {
    const items = await listKnowledgeDatasets();
    response.json({ items });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    response.status(500).json({ error: `Knowledge dataset list failed: ${reason}` });
  }
});

chatRoutes.post('/workflow/knowledge-datasets', async (request: Request, response: Response) => {
  const parsed = knowledgeDatasetInputSchema.safeParse(request.body);

  if (!parsed.success) {
    sendValidationError(response, parsed.error);
    return;
  }

  try {
    const item = await createKnowledgeDataset(parsed.data);
    response.status(201).json({ item });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    response.status(500).json({ error: `Knowledge dataset create failed: ${reason}` });
  }
});

chatRoutes.put('/workflow/knowledge-datasets/:datasetId', async (request: Request, response: Response) => {
  const parsed = knowledgeDatasetInputSchema.safeParse(request.body);

  if (!parsed.success) {
    sendValidationError(response, parsed.error);
    return;
  }

  try {
    const item = await updateKnowledgeDataset(String(request.params.datasetId || ''), parsed.data);
    response.json({ item });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';

    if (reason === 'KNOWLEDGE_DATASET_NOT_FOUND') {
      response.status(404).json({ error: 'Knowledge dataset not found' });
      return;
    }

    response.status(500).json({ error: `Knowledge dataset update failed: ${reason}` });
  }
});

chatRoutes.delete('/workflow/knowledge-datasets/:datasetId', async (request: Request, response: Response) => {
  try {
    const datasetId = String(request.params.datasetId || '');
    await deleteKnowledgeDataset(datasetId);
    await deleteKnowledgeDatasetFiles(datasetId);
    response.status(204).end();
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';

    if (reason === 'KNOWLEDGE_DATASET_NOT_FOUND') {
      response.status(404).json({ error: 'Knowledge dataset not found' });
      return;
    }

    response.status(500).json({ error: `Knowledge dataset delete failed: ${reason}` });
  }
});

chatRoutes.get('/workflow/knowledge-datasets/:datasetId/documents', async (request: Request, response: Response) => {
  try {
    const items = await listKnowledgeDocuments(String(request.params.datasetId || ''));
    response.json({ items });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';

    if (reason === 'KNOWLEDGE_DATASET_NOT_FOUND') {
      response.status(404).json({ error: 'Knowledge dataset not found' });
      return;
    }

    response.status(500).json({ error: `Knowledge documents list failed: ${reason}` });
  }
});

chatRoutes.get('/workflow/knowledge-datasets/:datasetId/documents/:documentId/blocks', async (request: Request, response: Response) => {
  try {
    const result = await getKnowledgeDocumentBlocks(
      String(request.params.datasetId || ''),
      String(request.params.documentId || ''),
    );
    response.json(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';

    if (reason === 'KNOWLEDGE_DATASET_NOT_FOUND') {
      response.status(404).json({ error: 'Knowledge dataset not found' });
      return;
    }

    if (reason === 'KNOWLEDGE_DOCUMENT_NOT_FOUND') {
      response.status(404).json({ error: 'Knowledge document not found' });
      return;
    }

    response.status(500).json({ error: `Knowledge document blocks failed: ${reason}` });
  }
});

chatRoutes.post('/workflow/knowledge-datasets/:datasetId/documents/import', async (request: Request, response: Response) => {
  const parsed = knowledgeDocumentImportSchema.safeParse(request.body);

  if (!parsed.success) {
    sendValidationError(response, parsed.error);
    return;
  }

  try {
    const result = await importKnowledgeDocument({
      datasetId: String(request.params.datasetId || ''),
      ...parsed.data,
    });
    response.status(201).json(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';

    if (reason === 'KNOWLEDGE_DATASET_NOT_FOUND') {
      response.status(404).json({ error: 'Knowledge dataset not found' });
      return;
    }

    response.status(500).json({ error: `Knowledge document import failed: ${reason}` });
  }
});

chatRoutes.post('/workflow/knowledge-datasets/preview-chunks', async (request: Request, response: Response) => {
  const parsed = knowledgeDocumentPreviewSchema.safeParse(request.body);

  if (!parsed.success) {
    sendValidationError(response, parsed.error);
    return;
  }

  try {
    const result = await previewKnowledgeDocuments(parsed.data);
    response.json(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    response.status(500).json({ error: `Knowledge document preview failed: ${reason}` });
  }
});

chatRoutes.post('/workflow/knowledge-retrieval/query', async (request: Request, response: Response) => {
  const parsed = knowledgeRetrievalQuerySchema.safeParse(request.body);

  if (!parsed.success) {
    sendValidationError(response, parsed.error);
    return;
  }

  try {
    const result = await runKnowledgeRetrievalQuery(parsed.data);
    response.json(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';

    if (reason === 'KNOWLEDGE_DATASET_NOT_FOUND') {
      response.status(404).json({ error: 'Knowledge dataset not found' });
      return;
    }

    response.status(500).json({ error: `Knowledge retrieval failed: ${reason}` });
  }
});

chatRoutes.post('/datasets/indexing-estimate', async (request: Request, response: Response) => {
  const parsed = indexingEstimateSchema.safeParse(request.body);

  if (!parsed.success) {
    sendValidationError(response, parsed.error);
    return;
  }

  try {
    const result = await runKnowledgeIndexingEstimate(parsed.data);
    response.json(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';

    if (reason === 'KNOWLEDGE_DATASET_NOT_FOUND') {
      response.status(404).json({ error: 'Knowledge dataset not found' });
      return;
    }

    if (reason === 'QA_MODEL_NOT_SUPPORTED' || reason === 'UNSUPPORTED_DATA_SOURCE_TYPE' || reason === 'UNSUPPORTED_FILE_REFERENCE_MODE' || reason === 'MISSING_UPLOAD_FILES') {
      response.status(400).json({ error: reason });
      return;
    }

    response.status(500).json({ error: `Knowledge indexing estimate failed: ${reason}` });
  }
});

chatRoutes.get('/hot-topics', async (_request: Request, response: Response) => {
  const result = await generateHotTopics();
  response.json(result);
});

chatRoutes.get('/attachments/:id', async (request: Request, response: Response) => {
  const id = String(request.params.id || '');
  const meta = await loadAttachmentMeta(id);

  if (!meta) {
    response.status(404).json({ error: 'Attachment not found' });
    return;
  }

  response.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
  response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  const diskFilePath = meta.filePath ? join(ATTACHMENTS_DIR, meta.filePath) : meta.storagePath;

  if (!diskFilePath) {
    response.status(404).end();
    return;
  }

  try {
    const stream = createReadStream(diskFilePath);
    stream.on('error', () => response.status(404).end());
    stream.pipe(response);
  } catch {
    response.status(404).end();
  }
});

chatRoutes.post('/token-embedding/analyze', async (request: Request, response: Response) => {
  const parsed = tokenEmbeddingSchema.safeParse(request.body);

  if (!parsed.success) {
    sendValidationError(response, parsed.error);
    return;
  }

  try {
    const result = await analyzeTokenAndEmbedding({
      text: parsed.data.text,
      maxChunkSize: parsed.data.maxChunkSize,
      projectionMethod: parsed.data.projectionMethod,
      attentionTokenLimit: parsed.data.attentionTokenLimit,
      secondaryTokenizer: parsed.data.secondaryTokenizer,
      secondaryEmbeddingModel: parsed.data.secondaryEmbeddingModel,
    });

    response.json(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    response.status(500).json({ error: `Token/Embedding analysis failed: ${reason}` });
  }
});

chatRoutes.post('/takeout/simulate', (request: Request, response: Response) => {
  const parsed = takeoutSimulationSchema.safeParse(request.body);

  if (!parsed.success) {
    sendValidationError(response, parsed.error);
    return;
  }

  const intentAnalysis = analyzeTakeoutIntent({
    prompt: parsed.data.payload?.prompt || '帮我点外卖',
  });

  const reply = simulateTakeoutReply({
    instruction: parsed.data.instruction,
    payload: parsed.data.payload,
  });

  response.json({
    reply,
    source: 'scenario',
    traceId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    intent: intentAnalysis.intent,
    confidence: intentAnalysis.confidence,
    slots: intentAnalysis.slots,
    missingSlots: intentAnalysis.missingSlots,
    nextAction: intentAnalysis.nextAction,
  });
});

chatRoutes.post('/takeout/intent-analyze', (request: Request, response: Response) => {
  const parsed = takeoutIntentSchema.safeParse(request.body);

  if (!parsed.success) {
    sendValidationError(response, parsed.error);
    return;
  }

  const result = analyzeTakeoutIntent({
    prompt: parsed.data.prompt,
    history: parsed.data.history,
  });

  response.json(result);
});

chatRoutes.post('/takeout/orchestrate', async (request: Request, response: Response) => {
  const parsed = takeoutOrchestrationSchema.safeParse(request.body);

  if (!parsed.success) {
    sendValidationError(response, parsed.error);
    return;
  }

  const result = await orchestrateTakeoutPrompt({
    prompt: parsed.data.prompt,
    history: parsed.data.history,
  });

  if (parsed.data.sessionId) {
    persistSessionMessagesSafely({
      sessionId: parsed.data.sessionId,
      messages: [
        { role: 'user', content: parsed.data.prompt },
        { role: 'assistant', content: result.assistantReply },
      ],
    });
  }

  response.json(result);
});

chatRoutes.post('/takeout/catalog', async (request: Request, response: Response) => {
  const parsed = takeoutCatalogSchema.safeParse(request.body);

  if (!parsed.success) {
    sendValidationError(response, parsed.error);
    return;
  }

  const result = await generateTakeoutCatalog({
    prompt: parsed.data.prompt,
    address: parsed.data.address,
  });

  response.json(result);
});

chatRoutes.post('/image/analyze', async (request: Request, response: Response) => {
  const parsed = imageAnalyzeSchema.safeParse(request.body);

  if (!parsed.success) {
    sendValidationError(response, parsed.error);
    return;
  }

  try {
    const attachment = await saveImageAttachment({
      dataUrl: parsed.data.imageDataUrl,
    });

    const result = await recognizeImageByDoubao({
      imageDataUrl: parsed.data.imageDataUrl,
      prompt: parsed.data.prompt,
    });

    if (parsed.data.sessionId) {
      const userPrompt = parsed.data.prompt?.trim() || '解释图片';
      persistSessionMessagesSafely({
        sessionId: parsed.data.sessionId,
        messages: [
          { role: 'user', content: '', attachments: [attachment] },
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: result.reply },
        ],
      });
    }

    response.json({ ...result, attachmentId: attachment.id });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    response.status(500).json({ error: `Image recognition failed: ${reason}` });
  }
});

chatRoutes.post('/file/analyze', async (request: Request, response: Response) => {
  const parsed = fileAnalyzeSchema.safeParse(request.body);

  if (!parsed.success) {
    sendValidationError(response, parsed.error);
    return;
  }

  try {
    const result = await analyzeFileByDoubao({
      fileDataUrl: parsed.data.fileDataUrl,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      prompt: parsed.data.prompt,
    });

    if (parsed.data.sessionId) {
      const userPrompt = parsed.data.prompt?.trim() || '请解读这个文件';
      persistSessionMessagesSafely({
        sessionId: parsed.data.sessionId,
        messages: [
          { role: 'user', content: `[文件] ${parsed.data.fileName}\n需求：${userPrompt}` },
          { role: 'assistant', content: result.reply },
        ],
      });
    }

    response.json(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    response.status(500).json({ error: `File analysis failed: ${reason}` });
  }
});

chatRoutes.post('/session/append', async (request: Request, response: Response) => {
  const parsed = sessionAppendSchema.safeParse(request.body);

  if (!parsed.success) {
    sendValidationError(response, parsed.error);
    return;
  }

  try {
    await appendSessionMessages({
      sessionId: parsed.data.sessionId,
      messages: parsed.data.messages,
    });

    response.status(204).end();
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    response.status(500).json({ error: `Session append failed: ${reason}` });
  }
});
