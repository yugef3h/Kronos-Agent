import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const resolveLocalKnowledgeDatasetsDir = (): string => {
  const cwd = process.cwd();
  const repoScopedDir = join(cwd, 'apps/server/data/knowledge-datasets');
  if (existsSync(join(cwd, 'apps/server'))) {
    return repoScopedDir;
  }
  return join(cwd, 'data/knowledge-datasets');
};

export const resolveKnowledgeExamplesDir = (): string => {
  const cwd = process.cwd();
  const repoScopedDir = join(cwd, 'apps/server/data/knowledge-examples');
  if (existsSync(join(cwd, 'apps/server'))) {
    return repoScopedDir;
  }
  return join(cwd, 'data/knowledge-examples');
};

const LOCAL_DATASETS_DIR = resolveLocalKnowledgeDatasetsDir();
const EXAMPLES_DIR = resolveKnowledgeExamplesDir();

export const getLocalKnowledgeDatasetsDir = (): string => LOCAL_DATASETS_DIR;

export const getKnowledgeExamplesDir = (): string => EXAMPLES_DIR;

export const isKnowledgeExampleDatasetId = (datasetId: string): boolean =>
  existsSync(join(EXAMPLES_DIR, `${datasetId}.json`));

const LOCAL_INDEX_FILE = join(dirname(LOCAL_DATASETS_DIR), 'knowledge-datasets.json');

/** 是否在本地 knowledge-datasets.json 索引中（与 example 元数据并列判断） */
export const isInLocalKnowledgeDatasetIndex = (datasetId: string): boolean => {
  try {
    const raw = readFileSync(LOCAL_INDEX_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Array<{ id?: string }>;
    return Array.isArray(parsed) && parsed.some((row) => row?.id === datasetId);
  } catch {
    return false;
  }
};

/**
 * 文档树目录：
 * 1. 仅存在于 example 的库 → 优先 example（避免本地残留目录盖住仓库示例）
 * 2. 本地索引有记录且存在 documents → 本地
 * 3. 否则回退 example
 */
export const resolveKnowledgeDatasetDataDir = (datasetId: string): string => {
  const localDir = join(LOCAL_DATASETS_DIR, datasetId);
  const exampleDir = join(EXAMPLES_DIR, datasetId);
  const exampleHasDocs = existsSync(join(exampleDir, 'documents'));
  const localHasDocs = existsSync(join(localDir, 'documents'));

  if (isKnowledgeExampleDatasetId(datasetId) && !isInLocalKnowledgeDatasetIndex(datasetId) && exampleHasDocs) {
    return exampleDir;
  }
  if (localHasDocs) {
    return localDir;
  }
  if (exampleHasDocs) {
    return exampleDir;
  }
  return localDir;
};

/** 示例内 documents.json 使用相对路径（documents/...） */
export const resolveKnowledgeStoredPath = (datasetId: string, storedPath: string): string => {
  if (storedPath.startsWith('documents/')) {
    return join(resolveKnowledgeDatasetDataDir(datasetId), storedPath);
  }
  return storedPath;
};
