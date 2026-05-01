import { type KnowledgeDatasetMutationInput } from '../../lib/api';
import type { KnowledgeDatasetDetail } from '../../domains/knowledge/types';
import type { ImportFormState, ImportMetadataFieldDraft } from './types';

/** 同批选择中去重；库内正文重复由服务端按 Dify 预处理 hash 判定 */
export const filterDuplicateFilesInBatch = (files: File[]): {
  acceptedFiles: File[];
  duplicateMessages: string[];
} => {
  const acceptedFiles: File[] = [];
  const duplicateMessages: string[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) {
      duplicateMessages.push(`「${file.name}」在本次选择中重复，已跳过`);
      continue;
    }
    seen.add(key);
    acceptedFiles.push(file);
  }

  return { acceptedFiles, duplicateMessages };
};

export const DOCUMENT_INPUT_ACCEPT = '.txt,.md,.mdx,.json,.csv,.yaml,.yml,.pdf,.doc,.docx,.xls,.xlsx,text/plain,text/markdown,text/csv,application/json,application/pdf,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const MIN_SEGMENT_MAX_LENGTH = 100;
export const MAX_SEGMENT_MAX_LENGTH = 12000;
export const PREVIEW_CHUNK_LIMIT = 48;
export const DRAFT_DATASET_ID = '__draft_preview__';

const SUPPORTED_DOCUMENT_EXTENSIONS = new Set([
  'txt',
  'md',
  'mdx',
  'json',
  'csv',
  'yaml',
  'yml',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
]);

const SUPPORTED_DOCUMENT_MIME_PREFIXES = [
  'text/',
];

const SUPPORTED_DOCUMENT_MIME_TYPES = new Set([
  'application/json',
  'application/ld+json',
  'application/x-ndjson',
  'application/pdf',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export const formatTimestamp = (timestamp?: number): string => {
  if (!timestamp) {
    return '未同步';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
};

export const getFileBaseName = (fileName: string) => {
  const segments = fileName.split('.');
  if (segments.length <= 1) {
    return fileName;
  }

  return segments.slice(0, -1).join('.');
};

export const getDatasetExtensionBadge = (extensions?: string[]) => {
  const normalized = Array.from(
    new Set((extensions ?? []).map((item) => item.trim().replace(/^\./, '').toLowerCase()).filter(Boolean)),
  );

  if (!normalized.length) {
    return 'DOC';
  }

  if (normalized.length > 1) {
    return 'MIX';
  }

  return normalized[0].slice(0, 4).toUpperCase();
};

export const formatFileSize = (size: number) => {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const isSupportedKnowledgeFile = (file: File) => {
  if (SUPPORTED_DOCUMENT_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix))) {
    return true;
  }

  if (SUPPORTED_DOCUMENT_MIME_TYPES.has(file.type)) {
    return true;
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_DOCUMENT_EXTENSIONS.has(extension);
};

export const filterSupportedKnowledgeFiles = (files: File[]) => {
  const acceptedFiles: File[] = [];
  const rejectedFiles: Array<{ fileName: string; reason: string }> = [];

  files.forEach((file) => {
    if (isSupportedKnowledgeFile(file)) {
      acceptedFiles.push(file);
      return;
    }

    rejectedFiles.push({
      fileName: file.name,
      reason: '仅支持 TXT、MD、JSON、CSV、PDF、DOC、DOCX、XLS、XLSX',
    });
  });

  return { acceptedFiles, rejectedFiles };
};

const getTopFolderName = (file: File): string => {
  const relativePath = 'webkitRelativePath' in file ? file.webkitRelativePath : '';
  if (!relativePath.includes('/')) {
    return '';
  }

  return relativePath.split('/')[0]?.trim() || '';
};

export const inferDatasetName = (files: File[]): string => {
  const [firstFile] = files;

  if (!firstFile) {
    return `知识库-${Date.now().toString(36)}`;
  }

  const folderName = getTopFolderName(firstFile);
  if (folderName) {
    return folderName;
  }

  if (files.length === 1) {
    return getFileBaseName(firstFile.name);
  }

  return `${getFileBaseName(firstFile.name)}-等${files.length}个文件`;
};

export const createImportFormState = (files: File[], datasetName?: string, description?: string): ImportFormState => ({
  datasetName: datasetName?.trim() || inferDatasetName(files),
  description: description?.trim() || `${files.length} 个文件导入`,
  separator: '\\n\\n',
  segmentMaxLength: '1024',
  overlapLength: '50',
  normalizeWhitespace: true,
  removeUrlsEmails: false,
  topK: '3',
  metadataFields: [],
});

const createMetadataFieldDraftId = () => `metadata-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const createMetadataDrafts = (fields: Array<{ key: string; label: string }>): ImportMetadataFieldDraft[] => {
  return fields.map((field) => ({
    id: createMetadataFieldDraftId(),
    key: field.key,
    label: field.label,
    value: '',
  }));
};

export const buildDocumentMetadata = (fields: ImportMetadataFieldDraft[]) => {
  return fields.reduce<Record<string, string>>((accumulator, field) => {
    const key = field.key.trim();
    const value = field.value.trim();

    if (!key || !value) {
      return accumulator;
    }

    accumulator[key] = value;
    return accumulator;
  }, {});
};

export const buildDatasetMetaUpdateInput = (
  dataset: KnowledgeDatasetDetail,
  patch: { name: string; description: string },
): KnowledgeDatasetMutationInput => ({
  name: patch.name.trim(),
  description: patch.description.trim(),
  is_multimodal: dataset.is_multimodal,
  doc_metadata: dataset.doc_metadata.map((field) => ({ key: field.key, label: field.label })),
  indexing_technique: dataset.indexing_technique,
  embedding_model: dataset.embedding_model,
  embedding_model_provider: dataset.embedding_model_provider,
  retrieval_model: dataset.retrieval_model,
  process_rule: dataset.process_rule,
  summary_index_setting: dataset.summary_index_setting,
  doc_form: dataset.doc_form,
  doc_language: dataset.doc_language,
});

export const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('文件读取失败'));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error(`读取文件失败：${file.name}`));
    };

    reader.readAsDataURL(file);
  });
};
