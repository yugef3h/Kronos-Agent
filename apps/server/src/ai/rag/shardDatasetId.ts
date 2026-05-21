/** 数据集分片键（预留水平扩展） */
export const shardDatasetId = (datasetId: string, shardCount = 4): string => {
  const normalized = datasetId.trim().toLowerCase();
  if (!normalized || shardCount <= 1) {
    return 'shard-0';
  }

  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }

  return `shard-${hash % shardCount}`;
};
