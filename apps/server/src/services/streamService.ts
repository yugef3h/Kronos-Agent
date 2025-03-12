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
    for await (const token of streamLangChainReply({ prompt, history })) {
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
  } catch {
    assistantText = '';
    eventId = 0;

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
