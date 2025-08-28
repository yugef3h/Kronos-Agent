import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  requestDatasetIndexingEstimate,
  requestImportKnowledgeDocument,
  requestKnowledgeDocuments,
} from '../lib/api';
import { useSearchParams } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from './workflow/base/dialog';
import {
  ensureKnowledgeDatasetAuthToken,
  useKnowledgeDatasets,
} from './workflow/features/knowledge-retrieval-panel/dataset-store';

const formatTimestamp = (timestamp?: number): string => {
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

const getFileBaseName = (fileName: string) => {
  const segments = fileName.split('.');
  if (segments.length <= 1) {
    return fileName;
  }

  return segments.slice(0, -1).join('.');
};

const getDatasetInitial = (name?: string) => {
  const initial = name?.trim().charAt(0) || '';
  return initial || '知';
};

const formatFileSize = (size: number) => {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

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

const DOCUMENT_INPUT_ACCEPT = '.txt,.md,.mdx,.json,.csv,.yaml,.yml,.pdf,.doc,.docx,.xls,.xlsx,text/plain,text/markdown,text/csv,application/json,application/pdf,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MIN_SEGMENT_MAX_LENGTH = 100;
const MAX_SEGMENT_MAX_LENGTH = 12000;
const PREVIEW_CHUNK_LIMIT = 48;
const DRAFT_DATASET_ID = '__draft_preview__';

type PendingImportConfig = {
  files: File[];
  datasetId?: string;
  source: 'file' | 'folder' | 'drop';
  rejectedFiles: Array<{ fileName: string; reason: string }>;
};

type ImportFormState = {
  datasetName: string;
  description: string;
  separator: string;
  segmentMaxLength: string;
  overlapLength: string;
  normalizeWhitespace: boolean;
  removeUrlsEmails: boolean;
  topK: string;
};

type LocalPreviewChunk = {
  id: string;
  index: number;
  text: string;
  tokenCount: number;
  charCount: number;
  fileName: string;
};

type LocalImportPreview = {
  totalNodes: number;
  tokens: number;
  totalChunks: number;
  previewableFileCount: number;
  skippedFiles: Array<{ fileName: string; reason: string }>;
  chunks: LocalPreviewChunk[];
};

const isSupportedKnowledgeFile = (file: File) => {
  if (SUPPORTED_DOCUMENT_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix))) {
    return true;
  }

  if (SUPPORTED_DOCUMENT_MIME_TYPES.has(file.type)) {
    return true;
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_DOCUMENT_EXTENSIONS.has(extension);
};

const filterSupportedKnowledgeFiles = (files: File[]) => {
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

const createImportFormState = (files: File[], datasetName?: string, description?: string): ImportFormState => ({
  datasetName: datasetName?.trim() || inferDatasetName(files),
  description: description?.trim() || `${files.length} 个文件导入`,
  separator: '\\n\\n',
  segmentMaxLength: '1024',
  overlapLength: '50',
  normalizeWhitespace: true,
  removeUrlsEmails: false,
  topK: '3',
});

const readFileAsDataUrl = (file: File): Promise<string> => {
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

const getTopFolderName = (file: File): string => {
  const relativePath = 'webkitRelativePath' in file ? file.webkitRelativePath : '';
  if (!relativePath.includes('/')) {
    return '';
  }

  return relativePath.split('/')[0]?.trim() || '';
};

const inferDatasetName = (files: File[]): string => {
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

export const RagPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const {
    datasets,
    isLoading,
    isMutating,
    errorMessage,
    refresh,
    createDataset,
    deleteDataset,
  } = useKnowledgeDatasets();
  const [pendingTargetDatasetId, setPendingTargetDatasetId] = useState('');
  const [pageError, setPageError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImportConfig | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importForm, setImportForm] = useState<ImportFormState>(() => createImportFormState([]));
  const [importFormError, setImportFormError] = useState('');
  const [localPreview, setLocalPreview] = useState<LocalImportPreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewRefreshTick, setPreviewRefreshTick] = useState(0);
  const [hasRequestedPreview, setHasRequestedPreview] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState(() => searchParams.get('dataset') || '');
  const [isDatasetDetailDialogOpen, setIsDatasetDetailDialogOpen] = useState(false);
  const [datasetDocuments, setDatasetDocuments] = useState<Array<{
    id: string;
    name: string;
    chunkCount: number;
    characterCount: number;
    size: number;
    updatedAt: number;
    previewText: string;
  }>>([]);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState('');

  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '');
    folderInputRef.current?.setAttribute('directory', '');
  }, []);

  const totals = useMemo(
    () =>
      datasets.reduce(
        (accumulator, dataset) => {
          accumulator.datasets += 1;
          accumulator.documents += dataset.documentCount ?? 0;
          accumulator.chunks += dataset.chunkCount ?? 0;
          return accumulator;
        },
        { datasets: 0, documents: 0, chunks: 0 },
      ),
    [datasets],
  );

  const pendingDataset = useMemo(
    () => datasets.find((item) => item.id === pendingImport?.datasetId),
    [datasets, pendingImport?.datasetId],
  );

  const selectedDataset = useMemo(
    () => datasets.find((item) => item.id === selectedDatasetId) || null,
    [datasets, selectedDatasetId],
  );

  const handleDatasetSelection = useCallback((datasetId: string, options?: { openDetail?: boolean }) => {
    setSelectedDatasetId(datasetId);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('dataset', datasetId);
      return next;
    }, { replace: true });
    if (options?.openDetail) {
      setIsDatasetDetailDialogOpen(true);
    }
  }, [setSearchParams]);

  const clearDatasetSelection = useCallback(() => {
    setSelectedDatasetId('');
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('dataset');
      return next;
    }, { replace: true });
    setIsDatasetDetailDialogOpen(false);
  }, [setSearchParams]);

  const refreshDatasetDocuments = useCallback(async (datasetId: string) => {
    setIsDocumentsLoading(true);
    setDocumentsError('');

    try {
      const authToken = await ensureKnowledgeDatasetAuthToken();
      if (!authToken) {
        throw new Error('知识库接口需要 JWT 鉴权');
      }

      const response = await requestKnowledgeDocuments({ authToken, datasetId });
      setDatasetDocuments(response.items.map((item) => ({
        id: item.id,
        name: item.name,
        chunkCount: item.chunkCount,
        characterCount: item.characterCount,
        size: item.size,
        updatedAt: item.updatedAt,
        previewText: item.previewText,
      })));
    } catch (error) {
      setDatasetDocuments([]);
      setDocumentsError(error instanceof Error ? error.message : '知识库详情加载失败');
    } finally {
      setIsDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    const datasetIdFromUrl = searchParams.get('dataset') || '';
    if (datasetIdFromUrl !== selectedDatasetId) {
      setSelectedDatasetId(datasetIdFromUrl);
    }
  }, [searchParams, selectedDatasetId]);

  useEffect(() => {
    if (!datasets.length) {
      setDatasetDocuments([]);
      return;
    }

    if (selectedDatasetId && datasets.some((item) => item.id === selectedDatasetId)) {
      return;
    }

    if (datasets[0]?.id) {
      handleDatasetSelection(datasets[0].id);
      return;
    }

    clearDatasetSelection();
  }, [clearDatasetSelection, datasets, handleDatasetSelection, selectedDatasetId]);

  useEffect(() => {
    if (!selectedDatasetId) {
      setDatasetDocuments([]);
      setDocumentsError('');
      setIsDocumentsLoading(false);
      return;
    }

    void refreshDatasetDocuments(selectedDatasetId);
  }, [refreshDatasetDocuments, selectedDatasetId]);

  useEffect(() => {
    if (!isImportDialogOpen || !pendingImport?.files.length) {
      setLocalPreview(null);
      setPreviewError('');
      setIsPreviewLoading(false);
      return;
    }

    if (!hasRequestedPreview) {
      setLocalPreview(null);
      setPreviewError('');
      setIsPreviewLoading(false);
      return;
    }

    const segmentMaxLength = Number(importForm.segmentMaxLength);
    const overlapLength = Number(importForm.overlapLength);
    if (!Number.isInteger(segmentMaxLength) || segmentMaxLength < MIN_SEGMENT_MAX_LENGTH || segmentMaxLength > MAX_SEGMENT_MAX_LENGTH) {
      setLocalPreview(null);
      setPreviewError('');
      setIsPreviewLoading(false);
      return;
    }

    if (!Number.isInteger(overlapLength) || overlapLength < 0 || overlapLength >= segmentMaxLength) {
      setLocalPreview(null);
      setPreviewError('');
      setIsPreviewLoading(false);
      return;
    }

    let isActive = true;
    setIsPreviewLoading(true);
    setPreviewError('');

    void (async () => {
      const authToken = await ensureKnowledgeDatasetAuthToken();
      if (!authToken) {
        throw new Error('知识库接口需要 JWT 鉴权');
      }

      const inputs = await Promise.all(
        pendingImport.files.map(async (file) => ({
          file_name: file.name,
          file_data_url: await readFileAsDataUrl(file),
          mime_type: file.type || undefined,
        })),
      );

      return requestDatasetIndexingEstimate({
        authToken,
        input: {
          dataset_id: pendingImport.datasetId || DRAFT_DATASET_ID,
          doc_form: 'text_model',
          doc_language: 'Chinese Simplified',
          process_rule: {
            mode: 'custom',
            rules: {
              pre_processing_rules: [
                { id: 'remove_extra_spaces', enabled: importForm.normalizeWhitespace },
                { id: 'remove_urls_emails', enabled: importForm.removeUrlsEmails },
              ],
              segmentation: {
                separator: importForm.separator,
                max_tokens: Math.max(100, Math.ceil(segmentMaxLength / 4)),
                chunk_overlap: Math.max(0, Math.ceil(overlapLength / 4)),
              },
              parent_mode: 'paragraph',
              subchunk_segmentation: {
                separator: '\\n',
                max_tokens: Math.max(50, Math.ceil(segmentMaxLength / 8)),
                chunk_overlap: Math.max(0, Math.ceil(overlapLength / 8)),
              },
            },
          },
          info_list: {
            data_source_type: 'upload_file',
            file_info_list: {
              files: inputs,
            },
          },
        },
      });
    })()
      .then((preview) => {
        if (!isActive) {
          return;
        }

        const chunks = preview.preview
          .flatMap((item, itemIndex) => {
            const nestedChunks = item.child_chunks.length
              ? item.child_chunks
              : [item.content];

            return nestedChunks.map((text, chunkIndex) => ({
              id: `estimate_${itemIndex}_${chunkIndex}`,
              index: chunkIndex,
              text,
              tokenCount: Math.max(1, Math.ceil(text.length / 4)),
              charCount: text.length,
              fileName: pendingImport.files.length === 1
                ? (pendingImport.files[0]?.name || '预览块')
                : `预览片段 ${itemIndex + 1}`,
            }));
          })
          .slice(0, PREVIEW_CHUNK_LIMIT);

        setLocalPreview({
          totalNodes: preview.total_nodes,
          tokens: preview.tokens,
          totalChunks: preview.total_segments,
          previewableFileCount: preview.total_nodes,
          skippedFiles: pendingImport.rejectedFiles,
          chunks,
        });
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setLocalPreview(null);
        setPreviewError(error instanceof Error ? error.message : '预览生成失败');
      })
      .finally(() => {
        if (!isActive) {
          return;
        }

        setIsPreviewLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [
    importForm.normalizeWhitespace,
    importForm.overlapLength,
    importForm.removeUrlsEmails,
    importForm.segmentMaxLength,
    importForm.separator,
    hasRequestedPreview,
    isImportDialogOpen,
    pendingImport,
    previewRefreshTick,
  ]);

  const openImportDialog = (files: File[], datasetId?: string, source: PendingImportConfig['source'] = 'file') => {
    const { acceptedFiles, rejectedFiles } = filterSupportedKnowledgeFiles(files);
    if (!acceptedFiles.length) {
      setPageError(rejectedFiles[0]?.reason || '没有可导入的文件');
      return;
    }

    const dataset = datasets.find((item) => item.id === datasetId);
    setPendingImport({ files: acceptedFiles, datasetId, source, rejectedFiles });
    setImportForm(
      createImportFormState(
        acceptedFiles,
        dataset?.name,
        dataset?.description || `${acceptedFiles.length} 个文件导入`,
      ),
    );
    setPageError(
      rejectedFiles.length
        ? `已跳过 ${rejectedFiles.length} 个不支持的文件：${rejectedFiles.slice(0, 3).map((item) => item.fileName).join('、')}`
        : '',
    );
    setImportFormError('');
    setIsImportDialogOpen(true);
    setHasRequestedPreview(false);
  };

  const closeImportDialog = () => {
    if (isImporting) {
      return;
    }

    setIsImportDialogOpen(false);
    setPendingImport(null);
    setImportForm(createImportFormState([]));
    setImportFormError('');
    setLocalPreview(null);
    setPreviewError('');
    setPreviewRefreshTick(0);
    setHasRequestedPreview(false);
    setPendingTargetDatasetId('');
  };

  const handlePickerOpen = (mode: 'file' | 'folder', datasetId?: string) => {
    setPendingTargetDatasetId(datasetId ?? '');

    if (mode === 'folder') {
      folderInputRef.current?.click();
      return;
    }

    fileInputRef.current?.click();
  };

  const handleImportFiles = async () => {
    if (!pendingImport?.files.length || isImporting) {
      return;
    }

    const segmentMaxLength = Number(importForm.segmentMaxLength);
    const overlapLength = Number(importForm.overlapLength);
    const topK = Number(importForm.topK);
    if (!Number.isInteger(segmentMaxLength) || segmentMaxLength < MIN_SEGMENT_MAX_LENGTH || segmentMaxLength > MAX_SEGMENT_MAX_LENGTH) {
      setImportFormError(`分段最大长度需在 ${MIN_SEGMENT_MAX_LENGTH} 到 ${MAX_SEGMENT_MAX_LENGTH} 之间。`);
      return;
    }

    if (!Number.isInteger(overlapLength) || overlapLength < 0 || overlapLength > 4000) {
      setImportFormError('分段重叠长度需在 0 到 4000 之间。');
      return;
    }

    if (overlapLength >= segmentMaxLength) {
      setImportFormError('重叠长度需要小于分段长度。');
      return;
    }

    if (!importForm.separator.trim()) {
      setImportFormError('请填写分段标识符。');
      return;
    }

    if (!pendingImport.datasetId && !importForm.datasetName.trim()) {
      setImportFormError('请填写知识库名称。');
      return;
    }

    if (!Number.isInteger(topK) || topK < 1 || topK > 10) {
      setImportFormError('Top K 需在 1 到 10 之间。');
      return;
    }

    setPageError('');
    setSuccessMessage('');
    setImportFormError('');
    setIsImporting(true);

    try {
      const files = pendingImport.files;
      let targetDatasetId = pendingImport.datasetId?.trim() || '';
      let targetDatasetName = datasets.find((item) => item.id === targetDatasetId)?.name || '';

      if (!targetDatasetId) {
        const nextDatasetName = importForm.datasetName.trim();
        const created = await createDataset({
          name: nextDatasetName || `知识库-${Date.now().toString(36)}`,
          description: importForm.description.trim() || `${files.length} 个文件导入`,
          is_multimodal: false,
          doc_metadata: [],
        });
        targetDatasetId = created.id;
        targetDatasetName = created.name;
      }

      const authToken = await ensureKnowledgeDatasetAuthToken();
      if (!authToken) {
        throw new Error('知识库接口需要 JWT 鉴权');
      }

      let importedCount = 0;
      const failedFiles: string[] = [];

      for (const file of files) {
        try {
          const fileDataUrl = await readFileAsDataUrl(file);

          await requestImportKnowledgeDocument({
            authToken,
            datasetId: targetDatasetId,
            input: {
              fileName: file.name,
              fileDataUrl,
              mimeType: file.type || undefined,
              maxTokens: Math.max(100, Math.ceil(segmentMaxLength / 4)),
              chunkOverlap: Math.max(0, Math.ceil(overlapLength / 4)),
              separator: importForm.separator,
              segmentMaxLength,
              overlapLength,
              preprocessingRules: {
                normalizeWhitespace: importForm.normalizeWhitespace,
                removeUrlsEmails: importForm.removeUrlsEmails,
              },
            },
          });

          importedCount += 1;
        } catch (error) {
          const reason = error instanceof Error && error.message ? error.message : '导入失败';
          failedFiles.push(`${file.name}：${reason}`);
        }
      }

      await refresh();
      await refreshDatasetDocuments(targetDatasetId);

      if (!importedCount) {
        throw new Error(failedFiles[0] || '没有文件导入成功');
      }

      const summary = `已导入 ${importedCount} 个文件 “${targetDatasetName || '知识库'}”`;
      setSuccessMessage(failedFiles.length ? `${summary}，${failedFiles.length} 个文件失败。` : `${summary}。`);
      handleDatasetSelection(targetDatasetId, { openDetail: true });
      setIsImportDialogOpen(false);
      setPendingImport(null);
      setImportForm(createImportFormState([]));
      setLocalPreview(null);
      setPreviewError('');
      setPreviewRefreshTick(0);

      if (failedFiles.length) {
        setPageError(failedFiles.slice(0, 3).join('；'));
      }
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '导入失败');
    } finally {
      setIsImporting(false);
      setPendingTargetDatasetId('');
    }
    };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
      const nextFiles = Array.from(event.target.files || []);
    if (nextFiles.length) {
      openImportDialog(
        nextFiles,
        pendingTargetDatasetId || undefined,
        event.target === folderInputRef.current ? 'folder' : 'file',
      );
    }

    event.target.value = '';
  };

  const handleDeleteDataset = async (datasetId: string, name: string) => {
    if (!window.confirm(`确认删除知识库“${name}”？`)) {
      return;
    }

    try {
      await deleteDataset(datasetId);
      if (selectedDatasetId === datasetId) {
        const fallback = datasets.find((item) => item.id !== datasetId)?.id;
        if (fallback) {
          handleDatasetSelection(fallback);
        } else {
          clearDatasetSelection();
        }
      }
      setPageError('');
      setSuccessMessage('知识库已删除。');
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '删除知识库失败');
    }
  };

  return (
    <>
      <section className="min-w-0 flex-1 rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-5 shadow-[0_24px_60px_-32px_rgba(8,145,178,0.35)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
            Datasets
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">知识库</h3>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-cyan-100 bg-white/80 px-2.5 py-1">
              {totals.datasets} 个知识库
            </span>
            {/* <span className="rounded-full border border-cyan-100 bg-white/80 px-2.5 py-1">
              {totals.documents} 份文档
            </span> */}
            <span className="rounded-full border border-cyan-100 bg-white/80 px-2.5 py-1">
              {totals.chunks} 个 chunks
            </span>
          </div>
        </div>

        {pageError || errorMessage ? (
          <p className="mt-4 text-sm text-rose-600">{pageError || errorMessage}</p>
        ) : null}
        {successMessage ? (
          <p className="mt-4 text-sm text-emerald-700">{successMessage}</p>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={DOCUMENT_INPUT_ACCEPT}
          className="hidden"
          onChange={handleInputChange}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          accept={DOCUMENT_INPUT_ACCEPT}
          className="hidden"
          onChange={handleInputChange}
        />

        <div className="mt-4 grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div
            className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
              isDragOver ? 'border-cyan-400 bg-cyan-50/60' : 'border-slate-200/80'
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragOver(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragOver(false);
              const nextFiles = Array.from(event.dataTransfer.files || []);
              if (nextFiles.length) {
                openImportDialog(nextFiles, undefined, 'drop');
              }
            }}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => handlePickerOpen('file')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handlePickerOpen('file');
                }
              }}
              className={`rounded-2xl border border-dashed px-4 py-5 text-center transition ${
                isDragOver
                  ? 'border-cyan-400 bg-cyan-50/70'
                  : 'border-slate-300 bg-slate-50/70 hover:border-cyan-300 hover:bg-cyan-50/40'
              }`}
            >
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M7 17a4 4 0 1 1 .8-7.9A5 5 0 0 1 17.5 10H18a3 3 0 1 1 0 6h-2.5" />
                  <path d="M12 12v8" />
                  <path d="m8.5 15.5 3.5-3.5 3.5 3.5" />
                </svg>
              </div>

              <p className="mt-3 text-[15px] font-semibold text-slate-800">
                拖拽文件至此，或者{' '}
                <span className="text-cyan-600">选择文件</span>
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                支持常见文档文件，单文件不超过 5 MB。
              </p>
            </div>
          </div>

          {datasets.map((dataset) => (
            <article
              key={dataset.id}
              role="button"
              tabIndex={0}
              onClick={() => handleDatasetSelection(dataset.id, { openDetail: true })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleDatasetSelection(dataset.id, { openDetail: true });
                }
              }}
              className={`group rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${selectedDatasetId === dataset.id ? 'border-cyan-400 ring-2 ring-cyan-100' : 'border-slate-200/80 hover:border-cyan-300'}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 text-lg">
                  {getDatasetInitial(dataset.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-cyan-700">
                    {dataset.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    更新时间 {formatTimestamp(dataset.updatedAt)}
                  </p>
                </div>
              </div>

              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                {dataset.description || '直接分析已导入文件，不走预设分类。'}
              </p>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span className="rounded-full bg-cyan-50 px-2.5 py-1 font-medium text-cyan-700">
                  {dataset.documentCount ?? 0} 文档
                </span>
                <span>{dataset.chunkCount ?? 0} chunks</span>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 ">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleDeleteDataset(dataset.id, dataset.name);
                  }}
                  disabled={isImporting || isMutating || isLoading}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <Dialog open={isImportDialogOpen} onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeImportDialog();
          return;
        }

        setIsImportDialogOpen(true);
      }}>
        <DialogContent overlayClassName="bg-slate-950/56" className="h-[min(84vh,760px)] w-[min(920px,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-hidden !bg-white p-0">

          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <DialogTitle className="text-base font-semibold text-slate-900">
              导入文件
            </DialogTitle>
          </div>

          <div className="grid h-[calc(100%-65px-49px)] min-h-0 gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-h-0 overflow-y-auto border-r border-slate-200 bg-white px-4 py-3">
              <div className="space-y-3">
                {!pendingDataset ? (
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <label className="min-w-0">
                      <span className="mb-1 block text-[11px] font-medium text-slate-600">知识库名称</span>
                      <input
                        type="text"
                        value={importForm.datasetName}
                        onChange={(event) => setImportForm((current) => ({ ...current, datasetName: event.target.value }))}
                        className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <label className="min-w-0">
                      <span className="mb-1 block text-[11px] font-medium text-slate-600">描述</span>
                      <input
                        type="text"
                        value={importForm.description}
                        onChange={(event) => setImportForm((current) => ({ ...current, description: event.target.value }))}
                        className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 text-sm text-slate-700">
                    <span className="truncate">目标知识库</span>
                    <span className="truncate font-medium text-slate-900">{pendingDataset.name}</span>
                  </div>
                )}

                <div className="grid gap-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <label className="min-w-0">
                    <span className="mb-1 block text-[11px] font-medium text-slate-600">分段标识符</span>
                    <input
                      type="text"
                      value={importForm.separator}
                      onChange={(event) => setImportForm((current) => ({ ...current, separator: event.target.value }))}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="mb-1 block text-[11px] font-medium text-slate-600">最大长度</span>
                    <div className="flex overflow-hidden rounded-md border border-slate-200 bg-white focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
                      <input
                        type="number"
                        min={MIN_SEGMENT_MAX_LENGTH}
                        max={MAX_SEGMENT_MAX_LENGTH}
                        value={importForm.segmentMaxLength}
                        onChange={(event) => setImportForm((current) => ({ ...current, segmentMaxLength: event.target.value }))}
                        className="w-full px-2.5 py-1.5 text-sm text-slate-900 outline-none"
                      />
                      <span className="border-l border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-500">char</span>
                    </div>
                  </label>
                  <label className="min-w-0">
                    <span className="mb-1 block text-[11px] font-medium text-slate-600">重叠长度</span>
                    <div className="flex overflow-hidden rounded-md border border-slate-200 bg-white focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
                      <input
                        type="number"
                        min={0}
                        max={4000}
                        value={importForm.overlapLength}
                        onChange={(event) => setImportForm((current) => ({ ...current, overlapLength: event.target.value }))}
                        className="w-full px-2.5 py-1.5 text-sm text-slate-900 outline-none"
                      />
                      <span className="border-l border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-500">char</span>
                    </div>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700">
                  <span className="text-[11px] font-medium text-slate-600">文本预处理</span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={importForm.normalizeWhitespace}
                      onChange={(event) => setImportForm((current) => ({ ...current, normalizeWhitespace: event.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>空白规整</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={importForm.removeUrlsEmails}
                      onChange={(event) => setImportForm((current) => ({ ...current, removeUrlsEmails: event.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>移除 URL / 邮箱</span>
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-[11px] font-medium text-slate-600">召回 Top K</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={importForm.topK}
                    onChange={(event) => setImportForm((current) => ({ ...current, topK: event.target.value }))}
                    className="w-14 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={Number(importForm.topK) || 1}
                    onChange={(event) => setImportForm((current) => ({ ...current, topK: event.target.value }))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600"
                  />
                  <span className="w-5 text-right text-xs text-slate-500">{importForm.topK}</span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setHasRequestedPreview(true);
                      setLocalPreview(null);
                      setPreviewError('');
                      setPreviewRefreshTick((current) => current + 1);
                    }}
                    className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                  >
                    预览块
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportForm(createImportFormState(pendingImport?.files || [], pendingDataset?.name, pendingDataset?.description));
                      setHasRequestedPreview(false);
                      setLocalPreview(null);
                      setPreviewError('');
                      setPreviewRefreshTick((current) => current + 1);
                    }}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                  >
                    重置
                  </button>
                </div>
              </div>
            </div>

            <aside className="min-h-0 overflow-hidden bg-slate-50 px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">预览</p>
                  <p className="text-[11px] text-slate-500">
                    {isPreviewLoading
                      ? '正在生成预览...'
                      : !hasRequestedPreview
                        ? ''
                      : `${localPreview?.totalNodes ?? (pendingImport?.files.length ?? 0)} 个文件，${localPreview?.totalChunks ?? 0} blocks，${localPreview?.tokens ?? 0} tokens`}
                  </p>
                </div>
                <span className="text-[11px] text-slate-500">
                  {formatFileSize((pendingImport?.files || []).reduce((sum, file) => sum + file.size, 0))}
                </span>
              </div>

              {previewError ? (
                <p className="mb-2 text-sm text-rose-600">{previewError}</p>
              ) : null}

              <div className="h-full min-h-0 overflow-y-auto pr-1">
                <div className="space-y-1.5 pb-12">
                  {/* {(pendingImport?.files || []).map((file) => (
                    <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-3 rounded-md bg-white px-2.5 py-2 text-xs text-slate-700 shadow-sm">
                      <span className="truncate">{file.name}</span>
                      <span className="shrink-0 text-[11px] text-slate-500">{formatFileSize(file.size)}</span>
                    </div>
                  ))} */}

                  {localPreview?.chunks.length ? localPreview.chunks.map((chunk) => (
                    <div key={chunk.id} className="rounded-md bg-white px-2.5 py-2 shadow-sm">
                      <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500">
                        <span className="truncate">{chunk.fileName}</span>
                        <span>#{chunk.index + 1}</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-5 text-slate-700">{chunk.text}</p>
                    </div>
                  )) : (
                    <div className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-5 text-center text-sm text-slate-500">
                      暂无预览块
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>

          <div className="border-t border-slate-200 bg-white px-4 py-3">
            {importFormError ? (
              <p className="mb-2 text-sm text-rose-600">{importFormError}</p>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeImportDialog}
                disabled={isImporting}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleImportFiles();
                }}
                disabled={isImporting || isMutating}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isImporting ? '处理中...' : '保存并处理'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDatasetDetailDialogOpen} onOpenChange={(nextOpen) => {
        setIsDatasetDetailDialogOpen(nextOpen);
      }}>
        <DialogContent overlayClassName="bg-slate-950/56" className="h-[min(82vh,760px)] w-[min(780px,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-hidden !bg-white p-0">
          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <DialogTitle className="text-base font-semibold text-slate-900">
              {selectedDataset?.name || '知识库详情'}
            </DialogTitle>
            <p className="mt-1 text-sm text-slate-500">
              {selectedDataset?.description || '查看当前知识库的文档摘要、chunk 统计和最近更新时间。'}
            </p>
          </div>

          <div className="min-h-0 overflow-y-auto bg-slate-50 px-4 py-4">
            {selectedDataset ? (
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-white px-2.5 py-1">{selectedDataset.documentCount ?? 0} 文档</span>
                <span className="rounded-full bg-white px-2.5 py-1">{selectedDataset.chunkCount ?? 0} chunks</span>
                <span className="rounded-full bg-white px-2.5 py-1">更新时间 {formatTimestamp(selectedDataset.updatedAt)}</span>
                <button
                  type="button"
                  onClick={() => {
                    void refreshDatasetDocuments(selectedDataset.id);
                  }}
                  className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700"
                >
                  刷新详情
                </button>
              </div>
            ) : null}

            {documentsError ? (
              <p className="mb-4 text-sm text-rose-600">{documentsError}</p>
            ) : null}

            <div className="space-y-2">
              {isDocumentsLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  正在加载知识库详情...
                </div>
              ) : null}

              {!isDocumentsLoading && !selectedDataset ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  还没有可查看的知识库。
                </div>
              ) : null}

              {!isDocumentsLoading && selectedDataset && !datasetDocuments.length ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  这个知识库还没有文档，保存并处理后会在这里显示文档详情。
                </div>
              ) : null}

              {!isDocumentsLoading && datasetDocuments.length ? datasetDocuments.map((document) => (
                <article key={document.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{document.name}</p>
                      <p className="mt-1 text-[11px] text-slate-500">更新时间 {formatTimestamp(document.updatedAt)}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-500">{formatFileSize(document.size)}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-1">{document.chunkCount} chunks</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">{document.characterCount} chars</span>
                  </div>

                  <p className="mt-3 line-clamp-4 text-xs leading-5 text-slate-600">{document.previewText || '暂无摘要'}</p>
                </article>
              )) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};