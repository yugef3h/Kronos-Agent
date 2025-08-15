import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { requestImportKnowledgeDocument } from '../lib/api';
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

  const handlePickerOpen = (mode: 'file' | 'folder', datasetId?: string) => {
    setPendingTargetDatasetId(datasetId ?? '');

    if (mode === 'folder') {
      folderInputRef.current?.click();
      return;
    }

    fileInputRef.current?.click();
  };

  const handleImportFiles = async (files: File[], datasetId?: string) => {
    if (!files.length || isImporting) {
      return;
    }

    setPageError('');
    setSuccessMessage('');
    setIsImporting(true);

    try {
      let targetDatasetId = datasetId?.trim() || '';
      let targetDatasetName = datasets.find((item) => item.id === targetDatasetId)?.name || '';

      if (!targetDatasetId) {
        const nextDatasetName = inferDatasetName(files).trim();
        const created = await createDataset({
          name: nextDatasetName || `知识库-${Date.now().toString(36)}`,
          description: `${files.length} 个文件导入`,
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
              maxTokens: 500,
              chunkOverlap: 80,
            },
          });

          importedCount += 1;
        } catch (error) {
          const reason = error instanceof Error && error.message ? error.message : '导入失败';
          failedFiles.push(`${file.name}：${reason}`);
        }
      }

      await refresh();

      if (!importedCount) {
        throw new Error(failedFiles[0] || '没有文件导入成功');
      }

      const summary = `已导入 ${importedCount} 个文件到“${targetDatasetName || '知识库'}”`;
      setSuccessMessage(failedFiles.length ? `${summary}，${failedFiles.length} 个文件失败。` : `${summary}。`);

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
      void handleImportFiles(nextFiles, pendingTargetDatasetId || undefined);
    }

    event.target.value = '';
  };

  const handleDeleteDataset = async (datasetId: string, name: string) => {
    if (!window.confirm(`确认删除知识库“${name}”？`)) {
      return;
    }

    try {
      await deleteDataset(datasetId);
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
          className="hidden"
          onChange={handleInputChange}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
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
                void handleImportFiles(nextFiles);
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
              className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 text-lg">
                  KB
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

              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handlePickerOpen('file', dataset.id)}
                  disabled={isImporting || isMutating}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700"
                >
                  导入文件
                </button>
                <button
                  type="button"
                  onClick={() => handlePickerOpen('folder', dataset.id)}
                  disabled={isImporting || isMutating}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  打开文件夹
                </button>
                <button
                  type="button"
                  onClick={() => {
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
    </>
  );
};