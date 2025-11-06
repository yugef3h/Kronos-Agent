import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PREVIEW_DIR = join(serverRoot, 'data', 'workflow-draft-previews');

export const normalizeWorkflowAppId = (id: string): string | null => {
  const normalized = id.trim();
  // 兼容历史 appId（不强制 wf_ 前缀），并阻止路径穿越字符。
  return /^[a-zA-Z0-9_-]{1,120}$/.test(normalized) ? normalized : null;
};

export const workflowDraftPreviewFilePath = (appId: string): string | null => {
  const id = normalizeWorkflowAppId(appId);
  if (!id) {
    return null;
  }
  return join(PREVIEW_DIR, `${id}.jpg`);
};

export async function saveWorkflowDraftPreviewJpeg(appId: string, buffer: Buffer): Promise<boolean> {
  const target = workflowDraftPreviewFilePath(appId);
  if (!target) {
    return false;
  }
  await mkdir(PREVIEW_DIR, { recursive: true });
  await writeFile(target, buffer);
  return true;
}

export async function readWorkflowDraftPreviewIfExists(appId: string): Promise<Buffer | null> {
  const target = workflowDraftPreviewFilePath(appId);
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
