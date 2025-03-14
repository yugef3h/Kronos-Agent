import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { getSessionSnapshot } from '../domain/sessionStore.js';
import { streamChat } from '../services/streamService.js';
import { analyzeTokenAndEmbedding } from '../services/tokenEmbeddingService.js';

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
