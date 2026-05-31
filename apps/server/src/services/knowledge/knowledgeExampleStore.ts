import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { KnowledgeDatasetRecord } from '../models/knowledgeDatasetStore.js';
import { getKnowledgeExamplesDir, isKnowledgeExampleDatasetId } from '../models/knowledgeDataPaths.js';

export { isKnowledgeExampleDatasetId };

const exampleMetaPath = (datasetId: string): string => join(getKnowledgeExamplesDir(), `${datasetId}.json`);

export const getKnowledgeExampleDatasetDataDir = (datasetId: string): string =>
  join(getKnowledgeExamplesDir(), datasetId);

export async function listKnowledgeExampleDatasets(): Promise<KnowledgeDatasetRecord[]> {
  const examplesDir = getKnowledgeExamplesDir();
  await mkdir(examplesDir, { recursive: true });
  const files = await readdir(examplesDir);
  const items: KnowledgeDatasetRecord[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }
    try {
      const raw = await readFile(join(examplesDir, file), 'utf-8');
      const parsed = JSON.parse(raw) as KnowledgeDatasetRecord;
      if (parsed?.id) {
        items.push(parsed);
      }
    } catch {
      console.warn(`[knowledge:example] 跳过损坏示例: ${file}`);
    }
  }

  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getKnowledgeExampleDataset(
  datasetId: string,
): Promise<KnowledgeDatasetRecord | null> {
  const target = exampleMetaPath(datasetId);
  try {
    await access(target);
    const raw = await readFile(target, 'utf-8');
    return JSON.parse(raw) as KnowledgeDatasetRecord;
  } catch {
    return null;
  }
}

export async function saveKnowledgeExampleDataset(record: KnowledgeDatasetRecord): Promise<void> {
  const examplesDir = getKnowledgeExamplesDir();
  await mkdir(examplesDir, { recursive: true });
  await writeFile(exampleMetaPath(record.id), JSON.stringify(record, null, 2), 'utf-8');
}

export async function deleteKnowledgeExampleDataset(datasetId: string): Promise<void> {
  try {
    await rm(exampleMetaPath(datasetId), { force: true });
  } catch {
    // ignore
  }
  try {
    await rm(getKnowledgeExampleDatasetDataDir(datasetId), { recursive: true, force: true });
  } catch {
    // ignore
  }
}
