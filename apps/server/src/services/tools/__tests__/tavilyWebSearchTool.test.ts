import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@tavily/core', () => ({
  tavily: () => ({
    search: jest.fn(async () => ({
      results: [{ title: 'Live', url: 'https://news.test', content: 'Update' }],
    })),
  }),
}));

import { createTavilyWebSearchTool } from '../../tavilyWebSearchTool.js';

describe('createTavilyWebSearchTool', () => {
  it('returns formatted search output', async () => {
    const webSearch = createTavilyWebSearchTool('tvly-test');
    const output = await webSearch.invoke({ query: 'today ai news' });

    expect(String(output)).toContain('Live');
    expect(String(output)).toContain('https://news.test');
  });
});
