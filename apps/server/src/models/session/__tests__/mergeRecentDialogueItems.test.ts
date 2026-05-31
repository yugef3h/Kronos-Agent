import { describe, expect, it } from '@jest/globals';
import { mergeRecentDialogueItems } from '../../../listRecentDialoguesFromRedis.js';
import type { RecentDialogueItem } from '../../../types.js';

const item = (
  sessionId: string,
  updatedAt: number,
): RecentDialogueItem => ({
  id: sessionId,
  sessionId,
  updatedAt,
  userContent: sessionId,
  playgroundSurface: 'default',
  basePlaygroundSessionId: sessionId,
  publishedChatbotWorkflowAppId: null,
});

describe('mergeRecentDialogueItems', () => {
  it('dedupes by sessionId and keeps newest updatedAt', () => {
    const merged = mergeRecentDialogueItems(
      [item('a', 100)],
      [item('a', 200), item('b', 150)],
      10,
    );

    expect(merged).toHaveLength(2);
    expect(merged[0]?.sessionId).toBe('a');
    expect(merged[0]?.updatedAt).toBe(200);
    expect(merged[1]?.sessionId).toBe('b');
  });
});
