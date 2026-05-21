const slotsByUser = new Map<string, Set<string>>();

const resolveMaxSlots = (): number => {
  const raw = process.env.AI_MAX_CONCURRENT_SESSIONS_PER_USER?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 3;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
};

/** 占用用户并发会话槽 */
export const acquireConcurrentSessionSlot = (userId: string, sessionId: string): boolean => {
  const max = resolveMaxSlots();
  const sessions = slotsByUser.get(userId) ?? new Set<string>();

  if (sessions.has(sessionId)) {
    return true;
  }

  if (sessions.size >= max) {
    return false;
  }

  sessions.add(sessionId);
  slotsByUser.set(userId, sessions);
  return true;
};

/** 释放会话槽 */
export const releaseConcurrentSessionSlot = (userId: string, sessionId: string): void => {
  const sessions = slotsByUser.get(userId);
  if (!sessions) {
    return;
  }

  sessions.delete(sessionId);
  if (sessions.size === 0) {
    slotsByUser.delete(userId);
  }
};

export const clearConcurrentSessionSlots = (): void => {
  slotsByUser.clear();
};
