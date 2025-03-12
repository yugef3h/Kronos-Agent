import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { listMessages } from '../domain/sessionStore.js';
import { streamChat } from '../services/streamService.js';

const chatSchema = z.object({
  prompt: z.string().min(1),
  sessionId: z.string().min(1),
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
  response.json({ messages: listMessages(sessionId) });
});
