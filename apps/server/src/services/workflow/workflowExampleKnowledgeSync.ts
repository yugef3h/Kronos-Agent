import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { KnowledgeDatasetRecord } from '../../models/knowledgeDatasetStore.js';
import {
  getKnowledgeDatasetById,
  initKnowledgeDatasetStore,
  removeKnowledgeDatasetFromLocalIndex,
} from '../../models/knowledgeDatasetStore.js';
import {
  getKnowledgeExamplesDir,
  getLocalKnowledgeDatasetsDir,
  isInLocalKnowledgeDatasetIndex,
  isKnowledgeExampleDatasetId,
} from '../../models/knowledgeDataPaths.js';
import { getKnowledgeExampleDataset, saveKnowledgeExampleDataset } from './knowledgeExampleStore.js';
import { collectDatasetIdsFromWorkflowApp } from './workflowKnowledgeDependencies.js';
import { listWorkflowExampleApps, type WorkflowExampleAppRecord } from './workflowExampleStore.js';

type DocumentIndexRow = {
  sourcePath?: string;
  parsedTextPath?: string;
  chunkPath?: string;
  chunkCount?: number;
};

/** 示例 documents.json 使用相对路径 documents/... */
export const toExampleRelativeDocumentPath = (datasetId: string, storedPath: string): string => {
  if (storedPath.startsWith('documents/')) {
    return storedPath;
  }

  const marker = `${datasetId}/documents/`;
  const byDataset = storedPath.indexOf(marker);
  if (byDataset >= 0) {
    return `documents/${storedPath.slice(byDataset + marker.length)}`;
  }

  const generic = storedPath.indexOf('/documents/');
  if (generic >= 0) {
    return storedPath.slice(generic + 1);
  }

  return storedPath;
};

const normalizeDocumentsIndexForExample = (
  datasetId: string,
  records: DocumentIndexRow[],
): DocumentIndexRow[] =>
  records.map((row) => ({
    ...row,
    sourcePath: typeof row.sourcePath === 'string' ? toExampleRelativeDocumentPath(datasetId, row.sourcePath) : row.sourcePath,
    parsedTextPath: typeof row.parsedTextPath === 'string'
      ? toExampleRelativeDocumentPath(datasetId, row.parsedTextPath)
      : row.parsedTextPath,
    chunkPath: typeof row.chunkPath === 'string' ? toExampleRelativeDocumentPath(datasetId, row.chunkPath) : row.chunkPath,
  }));

const dirMtime = async (dir: string): Promise<number> => {
  try {
    const info = await stat(dir);
    return info.mtimeMs;
  } catch {
    return 0;
  }
};

const pickDocumentsSourceDir = async (
  datasetId: string,
  localDir: string,
  exampleDir: string,
): Promise<string | null> => {
  const localDocs = join(localDir, 'documents');
  const exampleDocs = join(exampleDir, 'documents');
  const localHas = existsSync(localDocs);
  const exampleHas = existsSync(exampleDocs);

  if (!localHas && !exampleHas) {
    return null;
  }
  if (localHas && !exampleHas) {
    return localDir;
  }
  if (!localHas && exampleHas) {
    return exampleDir;
  }

  if (isInLocalKnowledgeDatasetIndex(datasetId)) {
    return localDir;
  }

  // 已在 examples 且本地无索引 → 本地目录多为残留，以 example 为准
  if (isKnowledgeExampleDatasetId(datasetId)) {
    return exampleDir;
  }

  const [localMtime, exampleMtime] = await Promise.all([dirMtime(localDocs), dirMtime(exampleDocs)]);
  return localMtime >= exampleMtime ? localDir : exampleDir;
};

const normalizeExampleDocumentsIndex = async (datasetId: string, exampleDir: string): Promise<void> => {
  const indexPath = join(exampleDir, 'documents', 'documents.json');
  try {
    const raw = await readFile(indexPath, 'utf-8');
    const parsed = JSON.parse(raw) as DocumentIndexRow[];
    if (Array.isArray(parsed)) {
      await writeFile(indexPath, JSON.stringify(normalizeDocumentsIndexForExample(datasetId, parsed), null, 2), 'utf-8');
    }
  } catch {
    // 无索引时跳过
  }
};

const copyDocumentsTreeToExample = async (datasetId: string, sourceDir: string, exampleDir: string): Promise<void> => {
  const sourceDocs = join(sourceDir, 'documents');
  const targetDocs = join(exampleDir, 'documents');

  await mkdir(exampleDir, { recursive: true });

  if (sourceDir === exampleDir) {
    await normalizeExampleDocumentsIndex(datasetId, exampleDir);
    return;
  }

  await rm(targetDocs, { recursive: true, force: true });
  await cp(sourceDocs, targetDocs, { recursive: true, force: true });
  await normalizeExampleDocumentsIndex(datasetId, exampleDir);
};

const readExampleDocumentStats = async (exampleDir: string): Promise<{ documentCount: number; chunkCount: number }> => {
  try {
    const raw = await readFile(join(exampleDir, 'documents', 'documents.json'), 'utf-8');
    const parsed = JSON.parse(raw) as DocumentIndexRow[];
    if (!Array.isArray(parsed)) {
      return { documentCount: 0, chunkCount: 0 };
    }
    return {
      documentCount: parsed.length,
      chunkCount: parsed.reduce((sum, row) => sum + (typeof row.chunkCount === 'number' ? row.chunkCount : 0), 0),
    };
  } catch {
    return { documentCount: 0, chunkCount: 0 };
  }
};

/**
 * 将工作流示例引用的知识库落盘到 knowledge-examples，并从本地索引/目录迁出，避免本地目录盖住示例。
 */
export const promoteKnowledgeDatasetToExample = async (datasetId: string): Promise<boolean> => {
  await initKnowledgeDatasetStore();

  const record = await getKnowledgeDatasetById(datasetId);
  if (!record) {
    console.warn(`[workflow:example:knowledge] 跳过未知知识库: ${datasetId}`);
    return false;
  }

  const localDir = join(getLocalKnowledgeDatasetsDir(), datasetId);
  const exampleDir = join(getKnowledgeExamplesDir(), datasetId);
  const sourceDir = await pickDocumentsSourceDir(datasetId, localDir, exampleDir);
  const existingExample = await getKnowledgeExampleDataset(datasetId);

  let documentsMutated = false;

  if (sourceDir) {
    documentsMutated = sourceDir !== exampleDir;
    await copyDocumentsTreeToExample(datasetId, sourceDir, exampleDir);
  } else if (!existingExample) {
    await mkdir(exampleDir, { recursive: true });
    documentsMutated = true;
  }

  const stats = await readExampleDocumentStats(exampleDir);
  const nextDocumentCount = stats.documentCount || record.documentCount;
  const nextChunkCount = stats.chunkCount || record.chunkCount;
  const statsChanged = nextDocumentCount !== record.documentCount || nextChunkCount !== record.chunkCount;
  const metaChanged = documentsMutated || statsChanged || !existingExample;

  if (metaChanged) {
    const payload: KnowledgeDatasetRecord = {
      ...record,
      documentCount: nextDocumentCount,
      chunkCount: nextChunkCount,
      updatedAt: documentsMutated || statsChanged || !existingExample ? Date.now() : existingExample.updatedAt,
    };
    await saveKnowledgeExampleDataset(payload);
  }

  if (isInLocalKnowledgeDatasetIndex(datasetId)) {
    await removeKnowledgeDatasetFromLocalIndex(datasetId);
  }

  if (existsSync(localDir) && sourceDir === localDir && localDir !== exampleDir) {
    await rm(localDir, { recursive: true, force: true });
  }

  // 清理盖住 example 的本地残留目录（未在索引中）
  if (
    existsSync(localDir)
    && localDir !== exampleDir
    && isKnowledgeExampleDatasetId(datasetId)
    && !isInLocalKnowledgeDatasetIndex(datasetId)
  ) {
    await rm(localDir, { recursive: true, force: true });
  }

  return true;
};

export const syncKnowledgeDatasetsForWorkflowExample = async (
  app: Pick<WorkflowExampleAppRecord, 'chatbotOrchestration' | 'dsl'>,
): Promise<string[]> => {
  const datasetIds = collectDatasetIdsFromWorkflowApp(app);
  const synced: string[] = [];

  for (const datasetId of datasetIds) {
    const ok = await promoteKnowledgeDatasetToExample(datasetId);
    if (ok) {
      synced.push(datasetId);
    }
  }

  return synced;
};

/** 启动时对齐全部内置示例引用的知识库（修复历史本地残留） */
export const reconcileAllWorkflowExampleKnowledge = async (): Promise<void> => {
  const apps = await listWorkflowExampleApps();
  const seen = new Set<string>();

  for (const app of apps) {
    for (const datasetId of collectDatasetIdsFromWorkflowApp(app)) {
      if (seen.has(datasetId)) {
        continue;
      }
      seen.add(datasetId);
      try {
        await promoteKnowledgeDatasetToExample(datasetId);
      } catch (error) {
        console.warn(`[workflow:example:knowledge] reconcile failed: ${datasetId}`, error);
      }
    }
  }
};
