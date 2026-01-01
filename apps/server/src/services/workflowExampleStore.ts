import { access, mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeWorkflowAppId, workflowDraftPreviewFilePath } from './workflowDraftPreviewDiskStore.js';
import { syncKnowledgeDatasetsForWorkflowExample } from './workflowExampleKnowledgeSync.js';

const resolveExamplesDir = (): string => {
  const cwd = process.cwd();
  const repoScoped = join(cwd, 'apps/server/data/workflow-examples');
  if (existsSync(join(cwd, 'apps/server'))) {
    return repoScoped;
  }
  return join(cwd, 'data/workflow-examples');
};

const EXAMPLES_DIR = resolveExamplesDir();
const PREVIEWS_DIR = join(EXAMPLES_DIR, 'previews');

export type WorkflowExampleAppRecord = {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  mockPublished?: boolean;
  publishedAt?: number;
  dsl: Record<string, unknown>;
  chatbotOrchestration?: Record<string, unknown>;
};

const exampleAppFilePath = (appId: string): string | null => {
  const id = normalizeWorkflowAppId(appId);
  if (!id) {
    return null;
  }
  return join(EXAMPLES_DIR, `${id}.json`);
};

export const workflowExamplePreviewFilePath = (appId: string): string | null => {
  const id = normalizeWorkflowAppId(appId);
  if (!id) {
    return null;
  }
  return join(PREVIEWS_DIR, `${id}.jpg`);
};

/** 列表用：示例是否已有缩略图（previews 或历史 workflow-draft-previews） */
export const workflowExampleHasDraftPreview = (appId: string): boolean => {
  const primary = workflowExamplePreviewFilePath(appId);
  if (primary && existsSync(primary)) {
    return true;
  }
  const legacy = workflowDraftPreviewFilePath(appId);
  return Boolean(legacy && existsSync(legacy));
};

export async function listWorkflowExampleApps(): Promise<WorkflowExampleAppRecord[]> {
  await mkdir(EXAMPLES_DIR, { recursive: true });
  const files = await readdir(EXAMPLES_DIR);
  const apps: WorkflowExampleAppRecord[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }
    try {
      const raw = await readFile(join(EXAMPLES_DIR, file), 'utf-8');
      const parsed = JSON.parse(raw) as WorkflowExampleAppRecord;
      if (parsed?.id && parsed.dsl) {
        apps.push(parsed);
      }
    } catch {
      console.warn(`[workflow:example] 跳过损坏示例: ${file}`);
    }
  }

  return apps.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getWorkflowExampleApp(appId: string): Promise<WorkflowExampleAppRecord | null> {
  const target = exampleAppFilePath(appId);
  if (!target) {
    return null;
  }
  try {
    await access(target);
    const raw = await readFile(target, 'utf-8');
    return JSON.parse(raw) as WorkflowExampleAppRecord;
  } catch {
    return null;
  }
}

export async function saveWorkflowExampleApp(record: WorkflowExampleAppRecord): Promise<boolean> {
  const id = normalizeWorkflowAppId(record.id);
  if (!id) {
    return false;
  }
  await mkdir(EXAMPLES_DIR, { recursive: true });
  const payload: WorkflowExampleAppRecord = { ...record, id };
  delete (payload as WorkflowExampleAppRecord & { hasDraftPreview?: boolean }).hasDraftPreview;
  await writeFile(exampleAppFilePath(id)!, JSON.stringify(payload, null, 2), 'utf-8');
  try {
    await syncKnowledgeDatasetsForWorkflowExample(payload);
  } catch (error) {
    console.warn(`[workflow:example] 同步关联知识库失败: ${id}`, error);
  }
  return true;
}

export async function deleteWorkflowExampleApp(appId: string): Promise<boolean> {
  const target = exampleAppFilePath(appId);
  if (!target) {
    return false;
  }
  try {
    await unlink(target);
  } catch {
    return false;
  }
  const preview = workflowExamplePreviewFilePath(appId);
  if (preview) {
    try {
      await unlink(preview);
    } catch {
      // ignore missing preview
    }
  }
  return true;
}

export async function saveWorkflowExamplePreviewJpeg(appId: string, buffer: Buffer): Promise<boolean> {
  const target = workflowExamplePreviewFilePath(appId);
  if (!target) {
    return false;
  }
  await mkdir(PREVIEWS_DIR, { recursive: true });
  await writeFile(target, buffer);
  return true;
}

export async function readWorkflowExamplePreviewIfExists(appId: string): Promise<Buffer | null> {
  const target = workflowExamplePreviewFilePath(appId);
  if (!target) {
    return null;
  }
  try {
    await access(target);
    return readFile(target);
  } catch {
    return null;
  }
}

/** 兼容：示例应用预览也可走 workflow-draft-previews（历史本地文件） */
export async function readWorkflowExamplePreviewFallback(appId: string): Promise<Buffer | null> {
  const primary = await readWorkflowExamplePreviewIfExists(appId);
  if (primary) {
    return primary;
  }
  const legacy = workflowDraftPreviewFilePath(appId);
  if (!legacy) {
    return null;
  }
  try {
    await access(legacy);
    return readFile(legacy);
  } catch {
    return null;
  }
}
