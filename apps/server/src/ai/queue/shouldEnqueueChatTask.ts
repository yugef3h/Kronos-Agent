const DEFAULT_ASYNC_CHAT_THRESHOLD_CHARS = 12_000;

const resolveThreshold = (): number => {
  const raw = process.env.AI_CHAT_ASYNC_THRESHOLD_CHARS?.trim();
  if (!raw) {
    return DEFAULT_ASYNC_CHAT_THRESHOLD_CHARS;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ASYNC_CHAT_THRESHOLD_CHARS;
};

/** Q-07: 超长 prompt 应走异步队列 */
export const shouldEnqueueChatTask = (promptChars: number): boolean => {
  const enabled = (process.env.AI_CHAT_ASYNC_ENABLED ?? 'false').trim().toLowerCase() === 'true';
  if (!enabled) {
    return false;
  }

  return promptChars >= resolveThreshold();
};
