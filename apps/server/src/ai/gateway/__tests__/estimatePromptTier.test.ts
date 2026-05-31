import { estimatePromptTier } from '../estimatePromptTier.js';

describe('estimatePromptTier', () => {
  it('returns small for prompts under 500 tokens', () => {
    expect(estimatePromptTier(120)).toBe('small');
  });

  it('returns large for prompts above 500 tokens', () => {
    expect(estimatePromptTier(1200)).toBe('large');
  });
});
