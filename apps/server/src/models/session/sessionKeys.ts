export const SESSION_REDIS_KEY_PREFIX = 'kronos:session:';

export const toSessionRedisKey = (sessionId: string): string =>
  `${SESSION_REDIS_KEY_PREFIX}${sessionId}`;
