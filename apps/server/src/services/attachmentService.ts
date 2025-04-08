import { mkdir, writeFile, readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import type { AttachmentMeta } from '../domain/sessionStore.js';

const _dirname = dirname(fileURLToPath(import.meta.url));
export const ATTACHMENTS_DIR = join(_dirname, '../../data/attachments');

const ensureDir = async () => {
  await mkdir(ATTACHMENTS_DIR, { recursive: true });
};

const parseDataUrl = (dataUrl: string): { mimeType: string; buffer: Buffer } => {
  const match = /^data:(.+);base64,(.*)$/i.exec(dataUrl);
  if (!match) {
    throw new Error('Invalid data URL');
  }
  const [, mimeType, base64] = match;
  return { mimeType, buffer: Buffer.from(base64, 'base64') };
};

const guessExtension = (mimeType: string): string => {
  const [, subtype] = mimeType.split('/');
  if (!subtype) return '';
  if (subtype.includes('+')) return `.${subtype.split('+')[0]}`;
  return `.${subtype}`;
};

export const saveImageAttachment = async (params: {
  dataUrl: string;
  fileName?: string;
}): Promise<AttachmentMeta> => {
  const { mimeType, buffer } = parseDataUrl(params.dataUrl);
  const id = randomUUID();
  const ext = params.fileName?.includes('.') ? params.fileName.slice(params.fileName.lastIndexOf('.')) : guessExtension(mimeType);
  const safeExt = ext && ext.length <= 8 ? ext : '';

  await ensureDir();
  const diskFileName = `${id}${safeExt}`;
  const filePath = join(ATTACHMENTS_DIR, diskFileName);
  const metaPath = join(ATTACHMENTS_DIR, `${id}.json`);

  await writeFile(filePath, buffer);

  const meta: AttachmentMeta = {
    id,
    type: 'image',
    fileName: params.fileName || `image${safeExt}` || 'image',
    mimeType,
    size: buffer.length,
    filePath: diskFileName,
    storagePath: filePath, // 兼容旧字段
    createdAt: Date.now(),
  };

  await writeFile(metaPath, JSON.stringify(meta), 'utf-8');

  return meta;
};

export const loadAttachmentMeta = async (id: string): Promise<AttachmentMeta | null> => {
  const metaPath = join(ATTACHMENTS_DIR, `${id}.json`);
  try {
    await access(metaPath);
    const raw = await readFile(metaPath, 'utf-8');
    const meta = JSON.parse(raw) as AttachmentMeta;

    // 兼容旧数据：如果没有 filePath，尝试从 storagePath 推导
    if (!meta.filePath && meta.storagePath) {
      const parts = meta.storagePath.split('/');
      meta.filePath = parts[parts.length - 1];
    }

    return meta;
  } catch {
    return null;
  }
};
