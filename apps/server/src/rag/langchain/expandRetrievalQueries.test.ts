import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { maybeExpandQueriesForLangchainRetrieval } from './expandRetrievalQueries.js';

describe('maybeExpandQueriesForLangchainRetrieval', () => {
  let previousFlag: string | undefined;

  beforeEach(() => {
    previousFlag = process.env.RAG_LC_MULTI_QUERY;
  });

  afterEach(() => {
    if (previousFlag === undefined) {
      delete process.env.RAG_LC_MULTI_QUERY;
    } else {
      process.env.RAG_LC_MULTI_QUERY = previousFlag;
    }
  });

  it('returns a single variant when multi-query is disabled', async () => {
    delete process.env.RAG_LC_MULTI_QUERY;
    await expect(maybeExpandQueriesForLangchainRetrieval('  alpha beta  ')).resolves.toEqual(['  alpha beta  ']);
  });

  it('returns original wrapper when input is only whitespace', async () => {
    delete process.env.RAG_LC_MULTI_QUERY;
    await expect(maybeExpandQueriesForLangchainRetrieval('   ')).resolves.toEqual(['   ']);
  });

  it('keeps single trimmed query when expansion enabled but chat env missing', async () => {
    process.env.RAG_LC_MULTI_QUERY = 'true';
    const savedKey = process.env.DOUBAO_API_KEY;
    const savedUrl = process.env.DOUBAO_BASE_URL;
    const savedModel = process.env.DOUBAO_MODEL;
    delete process.env.DOUBAO_API_KEY;
    delete process.env.DOUBAO_BASE_URL;
    delete process.env.DOUBAO_MODEL;
    await expect(maybeExpandQueriesForLangchainRetrieval('only one path')).resolves.toEqual(['only one path']);
    if (savedKey !== undefined) {
      process.env.DOUBAO_API_KEY = savedKey;
    }
    if (savedUrl !== undefined) {
      process.env.DOUBAO_BASE_URL = savedUrl;
    }
    if (savedModel !== undefined) {
      process.env.DOUBAO_MODEL = savedModel;
    }
  });
});
