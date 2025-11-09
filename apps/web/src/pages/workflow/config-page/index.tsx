import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useLatest } from 'ahooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';

import {
  createDefaultChatbotRecallSettings,
  getWorkflowAppById,
  updateWorkflowAppChatbotOrchestration,
  type WorkflowChatbotMetadataCondition,
  type WorkflowChatbotRecallSettings,
} from '../../../features/workflow/workflowAppStore';
import { apiUrl, requestKnowledgeRetrievalQuery } from '../../../lib/api';
import type { StreamChunk } from '../../../types/chat';
import { buildChatbotRetrievalInput } from './chatbotRetrievalInput';
import { useWorkflowChatbotOrch } from './useWorkflowChatbotOrch';
import {
  ensureKnowledgeDatasetAuthToken,
  useKnowledgeDatasets,
} from '../features/knowledge-retrieval-panel/dataset-store';
import { PanelInfoHint } from '../../../components/form/panel-info-hint';
import { PanelSliderInput, PanelToggle } from '../../../components/form/panel-form';

type ChatLine = { id: string; role: 'user' | 'assistant'; content: string };

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * Chatbot（`app.mode: chat`）编排：自研 RAG 经 `knowledge-retrieval/query`，对话经 `/api/chat-stream`。
 */
export const WorkflowConfigPage = () => {
  const [searchParams] = useSearchParams();
  const appId = searchParams.get('appId')?.trim() ?? '';
  const { orch, setOrch, persistOrch, debouncedPersistPrompt } = useWorkflowChatbotOrch(
    appId.length > 0 ? appId : undefined,
  );
  const orchLatest = useLatest(orch);
  const app = appId ? getWorkflowAppById(appId) : undefined;

  const { datasets, isLoading: isDatasetsLoading, errorMessage: datasetsError, refresh: refreshDatasets } =
    useKnowledgeDatasets();

  const [isDatasetPickerOpen, setIsDatasetPickerOpen] = useState(false);
  const [pendingDatasetIds, setPendingDatasetIds] = useState<string[]>([]);
  const [isRecallModalOpen, setIsRecallModalOpen] = useState(false);
  const [recallDraft, setRecallDraft] = useState<WorkflowChatbotRecallSettings>(() => createDefaultChatbotRecallSettings());

  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [debugInput, setDebugInput] = useState('');
  const [sendError, setSendError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const streamAbortRef = useRef<AbortController | null>(null);

  const recallHref = useMemo(() => {
    const first = orch.datasetIds[0];
    return first ? `/rag?dataset=${encodeURIComponent(first)}` : '/rag';
  }, [orch.datasetIds]);

  const openRecallModal = () => {
    const rs = orch.recallSettings ?? createDefaultChatbotRecallSettings();
    setRecallDraft({
      ...createDefaultChatbotRecallSettings(),
      ...rs,
      topK: Math.min(100, Math.max(1, Math.round(rs.topK))),
    });
    setIsRecallModalOpen(true);
  };

  const closeRecallModal = () => {
    setIsRecallModalOpen(false);
  };

  const saveRecallSettings = () => {
    const topK = Math.min(100, Math.max(1, Math.round(recallDraft.topK)));
    persistOrch((prev) => ({
      ...prev,
      recallSettings: {
        ...recallDraft,
        topK,
      },
    }));
    setIsRecallModalOpen(false);
  };

  const openPicker = () => {
    setPendingDatasetIds([...orch.datasetIds]);
    setIsDatasetPickerOpen(true);
    void refreshDatasets();
  };

  const togglePendingDataset = (id: string) => {
    setPendingDatasetIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  const confirmPicker = () => {
    persistOrch((prev) => ({ ...prev, datasetIds: [...pendingDatasetIds] }));
    setIsDatasetPickerOpen(false);
  };

  const removeDataset = (id: string) => {
    persistOrch((prev) => ({ ...prev, datasetIds: prev.datasetIds.filter((x) => x !== id) }));
  };

  const addMetadataCondition = () => {
    persistOrch((prev) => ({
      ...prev,
      metadataFilterMode: 'manual',
      metadataFilterConditions: [
        ...(prev.metadataFilterConditions ?? []),
        { id: newId(), field: '', operator: 'contains', value: '' },
      ],
    }));
  };

  const patchMetadataCondition = (rowId: string | undefined, patch: Partial<WorkflowChatbotMetadataCondition>) => {
    if (!rowId) {
      return;
    }
    persistOrch((prev) => ({
      ...prev,
      metadataFilterConditions: (prev.metadataFilterConditions ?? []).map((row) =>
        row.id === rowId ? { ...row, ...patch } : row,
      ),
    }));
  };

  const removeMetadataCondition = (rowId: string | undefined) => {
    if (!rowId) {
      return;
    }
    persistOrch((prev) => ({
      ...prev,
      metadataFilterConditions: (prev.metadataFilterConditions ?? []).filter((row) => row.id !== rowId),
    }));
  };

  const handleSend = async () => {
    const text = debugInput.trim();
    if (!text || isSending || !appId) {
      return;
    }

    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;

    setSendError('');
    setIsSending(true);
    setDebugInput('');

    const userLine: ChatLine = { id: newId(), role: 'user', content: text };
    const assistantId = newId();
    setMessages((m) => [...m, userLine, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      const token = await ensureKnowledgeDatasetAuthToken();
      if (!token.trim()) {
        throw new Error('需要开发 JWT（知识库鉴权）；请从其它页完成登录或检查后端 /api/dev/token。');
      }

      let contextBlock = '';
      const o = orchLatest.current ?? orch;
      if (o.datasetIds.length > 0) {
        const retrieval = await requestKnowledgeRetrievalQuery({
          authToken: token,
          input: buildChatbotRetrievalInput(text, o),
        });
        contextBlock =
          retrieval.items.length > 0
            ? retrieval.items.map((item, i) => `[${i + 1}] ${item.text}`).join('\n\n')
            : '（本次检索无命中片段，请检查知识库或 query。）';
      }

      const augmented = [
        o.systemPrompt.trim() || '你是帮助用户的助手。',
        o.datasetIds.length > 0 ? `## 知识库检索上下文\n${contextBlock}` : '',
        `## 当前用户问题\n${text}`,
      ]
        .filter(Boolean)
        .join('\n\n');

      const sessionId = `workflow-chatbot-${appId}`;
      let lastEventId = 0;
      let completed = false;

      await fetchEventSource(apiUrl('/api/chat-stream'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: augmented, sessionId }),
        signal: controller.signal,
        onmessage(event) {
          let payload: StreamChunk;
          try {
            payload = JSON.parse(event.data) as StreamChunk;
          } catch {
            return;
          }
          if (payload.eventId <= lastEventId) {
            return;
          }
          lastEventId = payload.eventId;
          if (payload.type === 'content') {
            setMessages((prev) =>
              prev.map((line) =>
                line.id === assistantId ? { ...line, content: line.content + payload.content } : line,
              ),
            );
          }
          if (payload.type === 'complete') {
            completed = true;
          }
        },
        onerror() {
          throw new Error('流式连接中断');
        },
        onclose() {
          if (!completed) {
            setMessages((prev) =>
              prev.map((line) =>
                line.id === assistantId && !line.content
                  ? { ...line, content: '（未收到完整回复，请重试。）' }
                  : line,
              ),
            );
          }
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '发送失败';
      setSendError(message);
      setMessages((prev) => prev.filter((line) => line.id !== assistantId));
    } finally {
      setIsSending(false);
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null;
      }
    }
  };

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  if (!appId) {
    return <Navigate to="/workflow" replace />;
  }

  if (!app) {
    return <Navigate to="/workflow" replace />;
  }

  if (app.dsl.app.mode !== 'chat') {
    return <Navigate to={`/workflow/draft?appId=${encodeURIComponent(app.id)}`} replace />;
  }

  const selectedLabels = orch.datasetIds
    .map((id) => datasets.find((d) => d.id === id)?.name)
    .filter(Boolean) as string[];

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-slate-50 text-slate-900">
      {isDatasetPickerOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-3"
          onClick={() => setIsDatasetPickerOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setIsDatasetPickerOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[min(480px,80vh)] w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="dataset-picker-title"
          >
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 id="dataset-picker-title" className="text-sm font-semibold text-slate-900">
                添加知识库
              </h3>
              <p className="mt-1 text-xs text-slate-500">可多选；Top K 与 Rerank 请在「召回设置」中配置。</p>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {isDatasetsLoading ? (
                <p className="px-2 py-4 text-center text-sm text-slate-500">加载中…</p>
              ) : datasets.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-slate-500">
                  暂无知识库，请先到
                  <Link to="/rag" className="mx-1 font-medium text-sky-700">
                    知识库
                  </Link>
                  创建。
                </p>
              ) : (
                <ul className="space-y-1">
                  {datasets.map((d) => (
                    <li key={d.id}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-slate-300"
                          checked={pendingDatasetIds.includes(d.id)}
                          onChange={() => togglePendingDataset(d.id)}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-900">{d.name}</span>
                          {d.description ? (
                            <span className="mt-0.5 line-clamp-2 text-xs text-slate-500">{d.description}</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {datasetsError ? <p className="px-4 pb-2 text-xs text-rose-600">{datasetsError}</p> : null}
            <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={() => setIsDatasetPickerOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmPicker}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isRecallModalOpen ? (
        <div
          className="fixed inset-0 z-[71] flex items-center justify-center bg-slate-900/40 px-3 py-6"
          onClick={closeRecallModal}
          onKeyDown={(e) => e.key === 'Escape' && closeRecallModal()}
          role="presentation"
        >
          <div
            className="flex max-h-[min(560px,calc(100dvh-3rem))] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="recall-settings-title"
          >
            <div className="shrink-0 border-b border-slate-100 px-5 py-4">
              <h3 id="recall-settings-title" className="text-base font-semibold text-slate-900">
                召回设置
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                默认情况下使用多路召回。从多个知识库中检索知识，然后重新排序。
              </p>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Rerank 设置</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-800">Rerank 模型</span>
                    <PanelInfoHint
                      content="重排序模型将根据候选文档列表与用户问题语义匹配度进行重新排序，从而改进语义排序的结果。"
                    />
                  </div>
                  <PanelToggle
                    checked={recallDraft.rerankingEnabled}
                    onChange={(next) =>
                      setRecallDraft((d) => ({
                        ...d,
                        rerankingEnabled: next,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-800">Top K</span>
                  <PanelInfoHint content="返回给模型的检索片段数量上限（1–100）。" />
                </div>
                <div className="mt-2">
                  <PanelSliderInput
                    min={1}
                    max={100}
                    step={1}
                    value={recallDraft.topK}
                    onChange={(v) => {
                      setRecallDraft((d) => {
                        if (v === null) {
                          return d;
                        }
                        return {
                          ...d,
                          topK: Math.min(100, Math.max(1, Math.round(v))),
                        };
                      });
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={closeRecallModal}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveRecallSettings}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* <Link
            to="/workflow"
            className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            ← 应用
          </Link> */}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{app.name}</p>
            {/* <p className="text-xs text-slate-500">Chatbot 编排 · 自研检索 + 流式对话</p> */}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 sm:inline">
            模型（服务端 stream 配置）
          </span>
          <button
            type="button"
            disabled
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white opacity-50"
          >
            发布
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-slate-200 overflow-hidden lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <section className="flex min-h-0 flex-col overflow-y-auto overflow-x-hidden bg-white p-4 lg:p-5">
          <h2 className="text-base font-semibold text-slate-900">编排</h2>

          <div className="mt-4 space-y-2">
            <div className="relative">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-slate-800" htmlFor="chatbot-system-prompt">
                  提示词
                </label>
                <button
                  type="button"
                  disabled
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-400"
                  title="后续接入"
                >
                  ✨ 生成
                </button>
              </div>

              {/* 父容器 relative + textarea 底部内边距留出空间 */}
              <textarea
                id="chatbot-system-prompt"
                value={orch.systemPrompt}
                onChange={(e) => {
                  const v = e.target.value;
                  setOrch((o) => ({ ...o, systemPrompt: v }));
                  debouncedPersistPrompt(v);
                }}
                onBlur={(e) => {
                  if (!appId) {
                    return;
                  }
                  updateWorkflowAppChatbotOrchestration(appId, (p) => ({
                    ...p,
                    systemPrompt: e.target.value,
                  }));
                }}
                rows={8}
                maxLength={6000}
                placeholder="在这里写你的提示词，输入'{'插入变量、输入'/'插入提示内容块（后续支持）"
                className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-1 focus:ring-sky-300
    pb-7" /* 增加底部内边距，防止文字被字数统计遮挡 */
              />

              {/* 绝对定位到 textarea 左下角内部 */}
              <p className="absolute bottom-3 left-3 text-xs text-slate-500 pointer-events-none">
                {orch.systemPrompt.length} / 6000
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">变量</span>
                <button type="button" disabled className="text-xs font-medium text-slate-400">
                  ＋ 添加
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                变量能通过用户输入表单引入提示词或开场白；后续与编排数据模型对齐。
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">上下文（知识库）</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={orch.datasetIds.length === 0}
                    title={orch.datasetIds.length === 0 ? '请先添加知识库' : undefined}
                    onClick={openRecallModal}
                    className={`text-xs font-medium ${
                      orch.datasetIds.length > 0
                        ? 'text-sky-700 hover:text-sky-800'
                        : 'cursor-not-allowed text-slate-400'
                    }`}
                  >
                    召回设置
                  </button>
                  <button
                    type="button"
                    onClick={openPicker}
                    className="text-xs font-medium text-sky-700 hover:text-sky-800"
                  >
                    ＋ 添加
                  </button>
                </div>
              </div>
              {/* <p className="mt-2 text-xs text-slate-500">
                多路召回 · Top K {orch.recallSettings?.topK ?? 4} · Rerank{' '}
                {orch.recallSettings?.rerankingEnabled ? '开' : '关'}
              </p> */}
              {orch.datasetIds.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {orch.datasetIds.map((id) => {
                    const name = datasets.find((d) => d.id === id)?.name ?? id;
                    return (
                      <li
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800"
                      >
                        <span className="max-w-[200px] truncate">{name}</span>
                        <button
                          type="button"
                          onClick={() => removeDataset(id)}
                          className="rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`移除 ${name}`}
                        >
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-slate-600">您可以导入知识库作为上下文</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-600">元数据过滤</span>
                <select
                  value={orch.metadataFilterMode}
                  onChange={(e) => {
                    const mode = e.target.value === 'manual' ? 'manual' : 'disabled';
                    persistOrch((prev) => ({
                      ...prev,
                      metadataFilterMode: mode,
                    }));
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
                >
                  <option value="disabled">禁用</option>
                  <option value="manual">手动</option>
                </select>
              </div>
              {orch.metadataFilterMode === 'manual' ? (
                <div className="mt-3 space-y-2 rounded-lg border border-dashed border-slate-200 bg-white p-3">
                  <p className="text-xs leading-relaxed text-slate-600">
                    字段、运算符与取值均非空时才会传给检索接口；与知识库文档元数据字段名对齐。
                  </p>
                  {(orch.metadataFilterConditions ?? []).map((row) => (
                    <div key={row.id} className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={row.field}
                        onChange={(e) => patchMetadataCondition(row.id, { field: e.target.value })}
                        placeholder="字段名"
                        className="min-w-[100px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                      />
                      <select
                        value={row.operator}
                        onChange={(e) =>
                          patchMetadataCondition(row.id, {
                            operator: e.target.value as WorkflowChatbotMetadataCondition['operator'],
                          })
                        }
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                      >
                        <option value="contains">包含</option>
                        <option value="equals">等于</option>
                        <option value="not_equals">不等于</option>
                      </select>
                      <input
                        type="text"
                        value={row.value}
                        onChange={(e) => patchMetadataCondition(row.id, { value: e.target.value })}
                        placeholder="取值"
                        className="min-w-[80px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => removeMetadataCondition(row.id)}
                        className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addMetadataCondition}
                    className="text-xs font-medium text-sky-700 hover:text-sky-800"
                  >
                    ＋ 添加条件
                  </button>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5">
              <span className="text-sm font-medium text-slate-800">视觉</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled className="text-xs text-slate-400">
                  设置
                </button>
                <span className="relative inline-flex h-6 w-11 cursor-not-allowed items-center rounded-full bg-slate-200">
                  <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white shadow" />
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden bg-white p-4 lg:p-5">
          <h2 className="text-base font-semibold text-slate-900">调试与预览</h2>
          <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-slate-50/40">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              {messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  输入问题后发送：将先走知识库检索（multiWay + Rerank），再注入 Prompt 并流式生成。
                </p>
              ) : (
                messages.map((line) => (
                  <div
                    key={line.id}
                    className={`max-w-[95%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${line.role === 'user'
                        ? 'ml-auto bg-sky-600 text-white'
                        : 'mr-auto border border-slate-200 bg-white text-slate-800'
                      }`}
                  >
                    {line.content || (line.role === 'assistant' && isSending ? '…' : '')}
                  </div>
                ))
              )}
            </div>
            {sendError ? <p className="border-t border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">{sendError}</p> : null}
            <div className="border-t border-slate-200 p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={debugInput}
                  onChange={(e) => setDebugInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="和 Bot 聊天"
                  disabled={isSending}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={isSending || !debugInput.trim()}
                  className="shrink-0 rounded-xl bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="发送"
                >
                  ➤
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${orch.datasetIds.length > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                }`}
            >
              <span aria-hidden>●</span>
              {orch.datasetIds.length > 0
                ? `已选 ${orch.datasetIds.length} 个知识库${selectedLabels[0] ? ` · ${selectedLabels[0]}` : ''} · Top K ${orch.recallSettings?.topK ?? 4} · Rerank ${orch.recallSettings?.rerankingEnabled ? '开' : '关'}`
                : '未选知识库（仅系统提示 + 问题）'}
            </span>
            <Link to={recallHref} className="font-medium text-sky-700 hover:text-sky-800">
              管理 →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};
