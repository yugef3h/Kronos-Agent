import { FALLBACK_HOT_TOPICS, generateHotTopics, parseHotTopicsOutput } from './hotTopicService';

describe('hotTopicService', () => {
  const previousEnv = {
    apiKey: process.env.DOUBAO_API_KEY,
    baseURL: process.env.DOUBAO_BASE_URL,
    model: process.env.DOUBAO_MODEL,
  };

  beforeEach(() => {
    delete process.env.DOUBAO_API_KEY;
    delete process.env.DOUBAO_BASE_URL;
    delete process.env.DOUBAO_MODEL;
  });

  afterAll(() => {
    process.env.DOUBAO_API_KEY = previousEnv.apiKey;
    process.env.DOUBAO_BASE_URL = previousEnv.baseURL;
    process.env.DOUBAO_MODEL = previousEnv.model;
  });

  it('parses five topics from json output', () => {
    expect(parseHotTopicsOutput('{"items":["问题1","问题2","问题3","问题4","问题5"]}')).toEqual([
      '问题1',
      '问题2',
      '问题3',
      '问题4',
      '问题5',
    ]);
  });

  it('falls back when model env is not configured', async () => {
    await expect(generateHotTopics()).resolves.toEqual({
      topics: [...FALLBACK_HOT_TOPICS],
      source: 'fallback',
    });
  });
});