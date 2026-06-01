import { Router } from 'express';
import type { Request, Response } from 'express';
import { getPrefixCacheStats, getPrefixCacheHitRate } from '../ai/cache/promptPrefixCache.js';

/** 缓存统计信息（供监控面板使用） */
export const cacheStatsRoutes = Router();

cacheStatsRoutes.get('/cache-stats', async (_request: Request, response: Response) => {
  const prefixStats = getPrefixCacheStats();

  response.json({
    l1_exact: {
      description: 'prompt + model_result exact match cache',
      store: process.env.AI_CACHE_REDIS === 'true' ? 'redis' : 'memory',
    },
    l1_semantic: {
      description: 'embedding cosine similarity cache (threshold > 0.95)',
      maxEntries: Number(process.env.AI_SEMANTIC_CACHE_MAX_ENTRIES?.trim() || '2000'),
    },
    l2_retrieval: {
      description: 'vector retrieval result cache (version-aware)',
      enabled: (process.env.AI_RETRIEVAL_CACHE_ENABLED ?? 'true').trim().toLowerCase() !== 'false',
    },
    l3_agent: {
      description: 'agent tool call + plan + reasoning cache',
      toolCacheEnabled: (process.env.AI_AGENT_TOOL_CACHE_ENABLED ?? 'true').trim().toLowerCase() !== 'false',
    },
    l4_prefix: {
      description: 'prompt prefix KV cache reuse tracking',
      ...prefixStats,
      hitRate: Math.round(getPrefixCacheHitRate() * 10000) / 100,
    },
    memoryCache: {
      maxEntries: Number(process.env.AI_CACHE_MAX_ENTRIES?.trim() || '5000'),
    },
  });
});
