import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { requestImportKnowledgeDocument } from '../lib/api';
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
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

const formatFileSize = (size: number) => {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

type PendingImportConfig = {
  files: File[];
  datasetId?: string;
  source: 'file' | 'folder' | 'drop';
};

type ImportFormState = {
  datasetName: string;
  description: string;
  maxTokens: string;
  chunkOverlap: string;
};

const createImportFormState = (files: File[], datasetName?: string, description?: string): ImportFormState => ({
  datasetName: datasetName?.trim() || inferDatasetName(files),
  description: description?.trim() || `${files.length} 个文件导入`,
  maxTokens: '500',
  chunkOverlap: '80',
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

  const openImportDialog = (files: File[], datasetId?: string, source: PendingImportConfig['source'] = 'file') => {
    if (!files.length) {
      return;
    }

    const dataset = datasets.find((item) => item.id === datasetId);
    setPendingImport({ files, datasetId, source });
    setImportForm(
      createImportFormState(
        files,
        dataset?.name,
        dataset?.description || `${files.length} 个文件导入`,
      ),
    );
    setImportFormError('');
    setIsImportDialogOpen(true);
  };

  const closeImportDialog = () => {
    if (isImporting) {
      return;
    }

    setIsImportDialogOpen(false);
    setPendingImport(null);
    setImportForm(createImportFormState([]));
    setImportFormError('');
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

    const maxTokens = Number(importForm.maxTokens);
    const chunkOverlap = Number(importForm.chunkOverlap);
    if (!Number.isInteger(maxTokens) || maxTokens < 100 || maxTokens > 4000) {
      setImportFormError('分段长度需在 100 到 4000 之间。');
      return;
    }

    if (!Number.isInteger(chunkOverlap) || chunkOverlap < 0 || chunkOverlap > 1000) {
      setImportFormError('重叠长度需在 0 到 1000 之间。');
      return;
    }

    if (chunkOverlap >= maxTokens) {
      setImportFormError('重叠长度需要小于分段长度。');
      return;
    }

    if (!pendingImport.datasetId && !importForm.datasetName.trim()) {
      setImportFormError('请填写知识库名称。');
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
              maxTokens,
              chunkOverlap,
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
      setIsImportDialogOpen(false);
      setPendingImport(null);
      setImportForm(createImportFormState([]));

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

      <Dialog open={isImportDialogOpen} onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeImportDialog();
          return;
        }

        setIsImportDialogOpen(true);
      }}>
        <DialogContent className="w-[720px] max-w-[calc(100vw-1rem)] overflow-hidden p-0">
          <div className="border-b border-slate-200 bg-gradient-to-r from-cyan-50 via-white to-sky-50 px-5 py-4">
            <DialogTitle className="text-base font-semibold text-slate-900">
              导入配置
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-slate-500">
              先确认分段参数和目标知识库，再执行最终入库。当前会把原文件、解析文本和 chunks 一并写入本地知识库目录。
            </DialogDescription>
            <DialogCloseButton className="right-4 top-4" />
          </div>

          <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1.15fr)_260px]">
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {pendingDataset ? '目标知识库' : '新建知识库'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {pendingDataset
                        ? `文件将追加到“${pendingDataset.name}”`
                        : '这批文件会先创建知识库，再写入文件索引。'}
                    </p>
                  </div>
                  <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-medium text-cyan-700">
                    {pendingImport?.source === 'folder'
                      ? '文件夹导入'
                      : pendingImport?.source === 'drop'
                        ? '拖拽导入'
                        : '文件导入'}
                  </span>
                </div>

                {pendingDataset ? (
                  <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50/60 px-3 py-3">
                    <p className="text-sm font-semibold text-slate-900">{pendingDataset.name}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {pendingDataset.description || '未填写描述'}
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">知识库名称</span>
                      <input
                        type="text"
                        value={importForm.datasetName}
                        onChange={(event) => setImportForm((current) => ({
                          ...current,
                          datasetName: event.target.value,
                        }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                        placeholder="例如：产品帮助中心"
                      />
                    </label>

                    <label className="block md:col-span-2">
                      <span className="text-xs font-medium text-slate-600">描述</span>
                      <textarea
                        value={importForm.description}
                        onChange={(event) => setImportForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))}
                        rows={3}
                        className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                        placeholder="说明这批文档的用途和来源"
                      />
                    </label>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">分段参数</p>
                  <p className="mt-1 text-xs text-slate-500">
                    当前后端会按文本切片并落盘到 chunks 文件，后续可继续补分段预览和索引方式。
                  </p>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">maxTokens</span>
                    <input
                      type="number"
                      min={100}
                      max={4000}
                      value={importForm.maxTokens}
                      onChange={(event) => setImportForm((current) => ({
                        ...current,
                        maxTokens: event.target.value,
                      }))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-slate-600">chunkOverlap</span>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={importForm.chunkOverlap}
                      onChange={(event) => setImportForm((current) => ({
                        ...current,
                        chunkOverlap: event.target.value,
                      }))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                    />
                  </label>
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-sm font-semibold text-slate-900">本次导入</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p>文件数</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{pendingImport?.files.length ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p>总大小</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatFileSize(
                        (pendingImport?.files || []).reduce((sum, file) => sum + file.size, 0),
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto pr-1">
                  {(pendingImport?.files || []).map((file) => (
                    <div
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                    >
                      <p className="truncate text-xs font-medium text-slate-800">{file.name}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{formatFileSize(file.size)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs leading-6 text-amber-900">
                当前这一步是 MVP：确认参数后直接调用现有导入接口落库。下一步再补“分段预览 / 成本估算 / 索引方式”即可与方案文档继续对齐。
              </section>
            </aside>
          </div>

          <div className="border-t border-slate-200 px-5 py-4">
            {importFormError ? (
              <p className="mb-3 text-sm text-rose-600">{importFormError}</p>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeImportDialog}
                disabled={isImporting}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleImportFiles();
                }}
                disabled={isImporting || isMutating}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isImporting ? '正在入库...' : '确认并入库'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};