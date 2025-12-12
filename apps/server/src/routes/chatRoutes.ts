import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { createReadStream } from 'fs';
import type { AttachmentMeta } from '../domain/sessionStore.js';
import {
  createKnowledgeDataset,
  deleteKnowledgeDataset,
  deleteKnowledgeDatasetFiles,
  getKnowledgeDocumentBlocks,
  importKnowledgeDocument,
  listKnowledgeDatasets,
  listKnowledgeDocuments,
  previewKnowledgeDocuments,
  runKnowledgeIndexingEstimate,
  runKnowledgeRetrievalQuery,
  updateKnowledgeDataset,
  updateKnowledgeDocumentBlockKeywords,
} from '../rag/knowledgeFacade.js';
import {
  indexingEstimateSchema,
  knowledgeDatasetInputSchema,
  knowledgeDocumentImportSchema,
  knowledgeDocumentKeywordsUpdateSchema,
  knowledgeDocumentPreviewSchema,
  knowledgeRetrievalCompareSchema,
  knowledgeRetrievalEvalSchema,
  knowledgeRetrievalQuerySchema,
} from '../rag/types.js';
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
import { ATTACHMENTS_DIR, loadAttachmentMeta, saveImageAttachment } from '../services/attachmentService.js';
import {
  normalizeWorkflowAppId,
  readWorkflowDraftPreviewIfExists,
  saveWorkflowDraftPreviewJpeg,
} from '../services/workflowDraftPreviewDiskStore.js';
import { join } from 'path';
import { computeKnowledgeDatasetHealth } from '../services/knowledgeDatasetHealthService.js';
import {
  createKnowledgeDatasetSnapshot,
  listKnowledgeDatasetSnapshots,
  readKnowledgeDatasetSnapshot,
} from '../services/knowledgeDatasetSnapshotService.js';
import { compareKnowledgeRetrievalQueries } from '../services/knowledgeRetrievalCompareService.js';
import { evaluateKnowledgeRetrievalRun } from '../services/knowledgeRetrievalEvalService.js';

const chatSchema = z.object({
  prompt: z.string().min(1),
  /** 写入会话历史的用户可见文案；缺省则与 prompt 相同（兼容旧客户端）。 */
  sessionUserContent: z.string().min(1).optional(),
  sessionId: z.string().min(1),
  imageDataUrls: z.array(z.string().min(32).max(6_000_000)).max(10).optional(),
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

  const imageDataUrls = parsed.data.imageDataUrls?.filter((u) => u.startsWith('data:image/'));

  const stream = streamChat({
    prompt: parsed.data.prompt,
    sessionUserContent: parsed.data.sessionUserContent,
    sessionId: parsed.data.sessionId,
    lastEventId,
    imageDataUrls: imageDataUrls && imageDataUrls.length > 0 ? imageDataUrls : undefined,
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
    const datasets = await listKnowledgeDatasets();
    const items = await Promise.all(
      datasets.map(async (dataset) => {
        const documents = await listKnowledgeDocuments(dataset.id);
        const documentExtensions = Array.from(
          new Set(
            documents
              .map((document) => document.extension.trim().toLowerCase())
              .filter(Boolean),
          ),
        ).sort((left, right) => left.localeCompare(right));

        return {
          ...dataset,
          documentExtensions,
        };
      }),
    );

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

chatRoutes.get('/workflow/knowledge-datasets/:datasetId/health', async (request: Request, response: Response) => {
  try {
    const report = await computeKnowledgeDatasetHealth(String(request.params.datasetId || ''));
    response.json(report);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';

    if (reason === 'KNOWLEDGE_DATASET_NOT_FOUND') {
      response.status(404).json({ error: 'Knowledge dataset not found' });
      return;
    }

    response.status(500).json({ error: `Knowledge dataset health failed: ${reason}` });
  }
});

chatRoutes.post('/workflow/knowledge-datasets/:datasetId/snapshots', async (request: Request, response: Response) => {
  try {
    const summary = await createKnowledgeDatasetSnapshot(String(request.params.datasetId || ''));
    response.status(201).json(summary);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';

    if (reason === 'KNOWLEDGE_DATASET_NOT_FOUND') {
      response.status(404).json({ error: 'Knowledge dataset not found' });
      return;
    }

    response.status(500).json({ error: `Knowledge snapshot create failed: ${reason}` });
  }
});

chatRoutes.get('/workflow/knowledge-datasets/:datasetId/snapshots', async (request: Request, response: Response) => {
  try {
    const items = await listKnowledgeDatasetSnapshots(String(request.params.datasetId || ''));
    response.json({ items });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    response.status(500).json({ error: `Knowledge snapshot list failed: ${reason}` });
  }
});

chatRoutes.get('/workflow/knowledge-datasets/:datasetId/snapshots/:snapshotId', async (request: Request, response: Response) => {
  try {
    const payload = await readKnowledgeDatasetSnapshot(
      String(request.params.datasetId || ''),
      String(request.params.snapshotId || ''),
    );
    response.json(payload);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';

    if (reason === 'SNAPSHOT_NOT_FOUND') {
      response.status(404).json({ error: 'Knowledge snapshot not found' });
      return;
    }

    response.status(404).json({ error: `Knowledge snapshot not found: ${reason}` });
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

chatRoutes.put('/workflow/knowledge-datasets/:datasetId/documents/:documentId/blocks/:blockId/keywords', async (request: Request, response: Response) => {
  const parsed = knowledgeDocumentKeywordsUpdateSchema.safeParse(request.body);

  if (!parsed.success) {
    sendValidationError(response, parsed.error);
    return;
  }

  try {
    const result = await updateKnowledgeDocumentBlockKeywords({
      datasetId: String(request.params.datasetId || ''),
      documentId: String(request.params.documentId || ''),
      chunkId: String(request.params.blockId || ''),
      keywords: parsed.data.keywords,
    });
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

    if (reason === 'KNOWLEDGE_DOCUMENT_BLOCK_NOT_FOUND') {
      response.status(404).json({ error: 'Knowledge document block not found' });
      return;
    }

    response.status(500).json({ error: `Knowledge block keyword update failed: ${reason}` });
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

/** 双引擎检索：`runKnowledgeRetrievalQuery` 经 `knowledgeFacade` 在 `RAG_ENGINE_MODE` 下切换自研 / LangChain。 */
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

chatRoutes.post('/workflow/knowledge-retrieval/compare', async (request: Request, response: Response) => {
  const parsed = knowledgeRetrievalCompareSchema.safeParse(request.body);

  if (!parsed.success) {
    sendValidationError(response, parsed.error);
    return;
  }

  try {
    const result = await compareKnowledgeRetrievalQueries(parsed.data.retrieval_a, parsed.data.retrieval_b);
    response.json(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';

    if (reason === 'KNOWLEDGE_DATASET_NOT_FOUND') {
      response.status(404).json({ error: 'Knowledge dataset not found' });
      return;
    }

    response.status(500).json({ error: `Knowledge retrieval compare failed: ${reason}` });
  }
});

/** 离线风格批量评测：Recall@K、MRR、拼接 chunk 的 EM/F1、证据外字符比例（无 LLM 裁判）。 */
chatRoutes.post('/workflow/knowledge-retrieval/evaluate', async (request: Request, response: Response) => {
  const parsed = knowledgeRetrievalEvalSchema.safeParse(request.body);

  if (!parsed.success) {
    sendValidationError(response, parsed.error);
    return;
  }

  try {
    const result = await evaluateKnowledgeRetrievalRun(parsed.data);
    response.json(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';

    if (reason === 'KNOWLEDGE_DATASET_NOT_FOUND') {
      response.status(404).json({ error: 'Knowledge dataset not found' });
      return;
    }

    response.status(500).json({ error: `Knowledge retrieval evaluate failed: ${reason}` });
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

chatRoutes.put('/workflow/apps/:appId/draft-preview', async (request: Request, response: Response) => {
  const appId = normalizeWorkflowAppId(String(request.params.appId || ''));
  if (!appId) {
    response.status(400).json({ error: 'Invalid app id' });
    return;
  }

  const dataUrl = typeof request.body?.dataUrl === 'string' ? request.body.dataUrl : '';
  const match = /^data:image\/(?:jpeg|jpg);base64,([\s\S]+)$/i.exec(dataUrl.trim());
  if (!match) {
    response.status(400).json({ error: 'Expected image/jpeg data URL' });
    return;
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[1].replace(/\s/g, ''), 'base64');
  } catch {
    response.status(400).json({ error: 'Invalid base64' });
    return;
  }

  if (buffer.length === 0 || buffer.length > 2_000_000) {
    response.status(413).json({ error: 'Image too large or empty' });
    return;
  }

  try {
    const ok = await saveWorkflowDraftPreviewJpeg(appId, buffer);
    if (!ok) {
      response.status(500).json({ error: 'Failed to save preview' });
      return;
    }
    response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Save failed';
    response.status(500).json({ error: message });
  }
});

chatRoutes.get('/workflow/apps/:appId/draft-preview', async (request: Request, response: Response) => {
  const appId = normalizeWorkflowAppId(String(request.params.appId || ''));
  if (!appId) {
    response.status(404).end();
    return;
  }

  const buf = await readWorkflowDraftPreviewIfExists(appId);
  if (!buf) {
    response.status(404).end();
    return;
  }

  response.setHeader('Content-Type', 'image/jpeg');
  response.setHeader('Cache-Control', 'private, max-age=120');
  response.send(buf);
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
