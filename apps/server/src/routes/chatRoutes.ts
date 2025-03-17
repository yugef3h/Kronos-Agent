import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { appendSessionMessages, getSessionSnapshot, listRecentDialogues } from '../domain/sessionStore.js';
import { streamChat } from '../services/streamService.js';
import { analyzeTakeoutIntent } from '../services/takeoutIntentService.js';
import { orchestrateTakeoutPrompt } from '../services/takeoutOrchestratorService.js';
import { simulateTakeoutReply } from '../services/takeoutSimulationService.js';
import { analyzeTokenAndEmbedding } from '../services/tokenEmbeddingService.js';
import { recognizeImageByDoubao } from '../services/imageRecognitionService.js';

const chatSchema = z.object({
  prompt: z.string().min(1),
  sessionId: z.string().min(1),
});

const tokenEmbeddingSchema = z.object({
  text: z.string().min(1).max(8000),
  maxChunkSize: z.number().int().min(40).max(500).default(180),
  projectionMethod: z.enum(['random', 'pca', 'umap']).default('pca'),
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

const imageAnalyzeSchema = z.object({
  imageDataUrl: z.string().min(64).max(8_000_000),
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

chatRoutes.post('/chat-stream', async (request: Request, response: Response) => {
  const parsed = chatSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.flatten() });
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

chatRoutes.post('/token-embedding/analyze', async (request: Request, response: Response) => {
  const parsed = tokenEmbeddingSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const result = await analyzeTokenAndEmbedding({
      text: parsed.data.text,
      maxChunkSize: parsed.data.maxChunkSize,
      projectionMethod: parsed.data.projectionMethod,
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
    response.status(400).json({ error: parsed.error.flatten() });
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
    response.status(400).json({ error: parsed.error.flatten() });
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
    response.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const result = await orchestrateTakeoutPrompt({
    prompt: parsed.data.prompt,
    history: parsed.data.history,
  });

  if (parsed.data.sessionId) {
    void appendSessionMessages({
      sessionId: parsed.data.sessionId,
      messages: [
        { role: 'user', content: parsed.data.prompt },
        { role: 'assistant', content: result.assistantReply },
      ],
    });
  }

  response.json(result);
});

chatRoutes.post('/image/analyze', async (request: Request, response: Response) => {
  const parsed = imageAnalyzeSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const result = await recognizeImageByDoubao({
      imageDataUrl: parsed.data.imageDataUrl,
      prompt: parsed.data.prompt,
    });

    if (parsed.data.sessionId) {
      const userPrompt = parsed.data.prompt?.trim() || '解释图片';
      void appendSessionMessages({
        sessionId: parsed.data.sessionId,
        messages: [
          { role: 'user', content: `[图片] ${userPrompt}` },
          { role: 'assistant', content: result.reply },
        ],
      });
    }

    response.json(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    response.status(500).json({ error: `Image recognition failed: ${reason}` });
  }
});

chatRoutes.post('/session/append', async (request: Request, response: Response) => {
  const parsed = sessionAppendSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: parsed.error.flatten() });
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
