import { getSession } from '../domain/sessionStore.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function* streamChat(params: {
  prompt: string;
  sessionId: string;
  lastEventId: number;
}) {
  const { prompt, sessionId, lastEventId } = params;
  const session = getSession(sessionId);

  session.messages.push({ role: 'user', content: prompt });

  const assistantText = `You asked: ${prompt}. This stream is from the new modular server architecture.`;
  const tokens = assistantText.split('');

  for (let i = lastEventId; i < tokens.length; i += 1) {
    const eventId = i + 1;
    yield `data: ${JSON.stringify({
      type: 'content',
      content: tokens[i],
      sessionId,
      eventId,
    })}\nid: ${eventId}\n\n`;

    await sleep(35);
  }

  const completeId = tokens.length + 1;
  yield `data: ${JSON.stringify({ type: 'complete', sessionId, eventId: completeId })}\nid: ${completeId}\n\n`;

  session.messages.push({ role: 'assistant', content: assistantText });
  session.lastId = completeId;
}
