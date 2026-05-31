import { describe, expect, it } from '@jest/globals';
import { shouldUseWebSearch } from '../../../shouldUseWebSearch';

describe('shouldUseWebSearch', () => {
  it('returns true for freshness keywords', () => {
    expect(shouldUseWebSearch('今天有什么 AI 新闻')).toBe(true);
    expect(shouldUseWebSearch('latest tesla stock price')).toBe(true);
  });

  it('returns false for generic coding prompts', () => {
    expect(shouldUseWebSearch('用 Python 写快排')).toBe(false);
  });
});
