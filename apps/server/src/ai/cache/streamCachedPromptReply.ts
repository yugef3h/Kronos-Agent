/** 将缓存回答编码为 Playground SSE 事件流 */
export const streamCachedPromptReply = function* (
  text: string,
  sessionId: string,
  lastEventId: number,
): Generator<string> {
  let eventId = lastEventId;

  eventId += 1;
  if (eventId > lastEventId) {
    yield `data: ${JSON.stringify({ type: 'content', content: text, sessionId, eventId })}\nid: ${eventId}\n\n`;
  }

  eventId += 1;
  yield `data: ${JSON.stringify({ type: 'complete', sessionId, eventId })}\nid: ${eventId}\n\n`;
};
