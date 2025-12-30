import { existsSync } from 'node:fs';
import { join } from 'node:path';

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

/** 文档树目录：本地有 documents 用本地，否则用仓库示例目录 */
export const resolveKnowledgeDatasetDataDir = (datasetId: string): string => {
  const localDir = join(LOCAL_DATASETS_DIR, datasetId);
  if (existsSync(join(localDir, 'documents'))) {
    return localDir;
  }
  const exampleDir = join(EXAMPLES_DIR, datasetId);
  if (existsSync(join(exampleDir, 'documents'))) {
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
