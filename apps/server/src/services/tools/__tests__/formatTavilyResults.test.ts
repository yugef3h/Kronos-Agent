import { describe, expect, it } from '@jest/globals';
import { formatTavilyResultsForLlm } from './formatTavilyResults';

describe('formatTavilyResultsForLlm', () => {
  it('returns empty message when no hits', () => {
    expect(formatTavilyResultsForLlm('ai news', [])).toContain('No web results');
  });

  it('formats title url and snippet', () => {
    const text = formatTavilyResultsForLlm('ai news', [
      { title: 'Headline', url: 'https://example.com', content: 'Body text' },
    ]);

    expect(text).toContain('Headline');
    expect(text).toContain('https://example.com');
    expect(text).toContain('Body text');
  });
});
