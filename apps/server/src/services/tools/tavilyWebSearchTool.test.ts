import { describe, expect, it, jest } from '@jest/globals';

jest.unstable_mockModule('@tavily/core', () => ({
  tavily: () => ({
    search: jest.fn(async () => ({
      results: [{ title: 'Live', url: 'https://news.test', content: 'Update' }],
    })),
  }),
}));

const { createTavilyWebSearchTool } = await import('./tavilyWebSearchTool');

describe('createTavilyWebSearchTool', () => {
  it('returns formatted search output', async () => {
    const webSearch = createTavilyWebSearchTool('tvly-test');
    const output = await webSearch.invoke({ query: 'today ai news' });

    expect(String(output)).toContain('Live');
    expect(String(output)).toContain('https://news.test');
  });
});
