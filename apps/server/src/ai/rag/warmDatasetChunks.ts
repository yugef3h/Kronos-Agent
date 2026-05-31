import { listKnowledgeDatasetChunks } from '../../models/knowledgeDocumentStore.js';
import { setWarmChunks } from './chunkWarmCache.js';

/** 预热加载数据集 chunks 到内存 */
export const warmDatasetChunks = async (datasetId: string): Promise<number> => {
  const chunks = await listKnowledgeDatasetChunks(datasetId);
  setWarmChunks(datasetId, chunks);
  return chunks.length;
};
