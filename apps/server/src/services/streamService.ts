import { getSession } from '../domain/sessionStore.js';
import { streamLangChainReply } from './langchainChatService.js';
import { streamMockReply } from './mockReplyService.js';

export async function* streamChat(params: {
  prompt: string;
  sessionId: string;
  lastEventId: number;
}) {
  const { prompt, sessionId, lastEventId } = params;
  const session = getSession(sessionId);

  session.messages.push({ role: 'user', content: prompt });

  const history = session.messages.slice(-8, -1);
  let assistantText = '';
  let eventId = 0;

  try {
    for await (const event of streamLangChainReply({ prompt, history })) {
      eventId += 1;

      if (eventId <= lastEventId) {
        continue;
      }

      if (event.type === 'timeline') {
        yield `data: ${JSON.stringify({
          type: 'timeline',
          stage: event.stage,
          status: event.status,
          message: event.message,
          toolName: event.toolName,
          timestamp: event.timestamp,
          sessionId,
          eventId,
        })}\nid: ${eventId}\n\n`;

        continue;
      }

      assistantText += event.content;

      yield `data: ${JSON.stringify({
        type: 'content',
        content: event.content,
        sessionId,
        eventId,
      })}\nid: ${eventId}\n\n`;
    }
  } catch (error) {
    assistantText = '';

    const fallbackReason =
      error instanceof Error && error.message.trim().length > 0
        ? error.message.slice(0, 180)
        : 'unknown upstream error';

    console.warn(
      `[streamChat] LangChain fallback enabled for session ${sessionId}. reason: ${fallbackReason}`,
    );

    eventId += 1;
    yield `data: ${JSON.stringify({
      type: 'timeline',
      stage: 'reason',
      status: 'info',
      message: `LangChain stream failed, fallback mock response is enabled. reason: ${fallbackReason}`,
      sessionId,
      eventId,
      timestamp: Date.now(),
    })}\nid: ${eventId}\n\n`;

    for await (const token of streamMockReply(prompt)) {
      eventId += 1;
      assistantText += token;

      if (eventId <= lastEventId) {
        continue;
      }

      yield `data: ${JSON.stringify({
        type: 'content',
        content: token,
        sessionId,
        eventId,
      })}\nid: ${eventId}\n\n`;
    }
  }

  const completeId = eventId + 1;
  yield `data: ${JSON.stringify({ type: 'complete', sessionId, eventId: completeId })}\nid: ${completeId}\n\n`;

  session.messages.push({ role: 'assistant', content: assistantText });
  session.lastId = completeId;
}
