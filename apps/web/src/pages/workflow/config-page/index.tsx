import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useLatest } from 'ahooks';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';

import {
  createDefaultChatbotRecallSettings,
  getWorkflowAppById,
  updateWorkflowAppChatbotOrchestration,
  type WorkflowChatbotMetadataCondition,
  type WorkflowChatbotPromptVariable,
  type WorkflowChatbotRecallSettings,
} from '../../../features/workflow/workflowAppStore';
import { apiUrl, requestKnowledgeRetrievalQuery } from '../../../lib/api';
import type { StreamChunk } from '../../../types/chat';
import { buildChatbotRetrievalInput } from './chatbotRetrievalInput';
import { ChatbotPromptEditor, IconBraceVar } from './chatbot-prompt-editor';
import {
  applyPromptVariables,
  extractDoubleBraceVariableKeys,
  isValidPromptVariableKey,
  replaceDoubleBraceKeyInPrompt,
  stripDoubleBracePlaceholdersForKey,
  syncPromptVariablesToBraceKeys,
} from './promptVariablesUtils';
import { useWorkflowChatbotOrch } from './useWorkflowChatbotOrch';
import {
  ensureKnowledgeDatasetAuthToken,
  useKnowledgeDatasets,
} from '../features/knowledge-retrieval-panel/dataset-store';
import { KnowledgeDatasetPickerDialog } from '../../../components/knowledge-dataset-picker-dialog';
import { PanelInfoHint } from '../../../components/form/panel-info-hint';
import { PanelSliderInput, PanelToggle } from '../../../components/form/panel-form';
import { prepareImageForAnalyze } from '../../../features/agent-tools/image';

type ChatLine = { id: string; role: 'user' | 'assistant'; content: string; imageCount?: number };

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
  const [isRecallModalOpen, setIsRecallModalOpen] = useState(false);
  const [recallDraft, setRecallDraft] = useState<WorkflowChatbotRecallSettings>(() => createDefaultChatbotRecallSettings());

  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [debugInput, setDebugInput] = useState('');
  const [sendError, setSendError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingVisionDataUrls, setPendingVisionDataUrls] = useState<string[]>([]);
  const [debugVariableValues, setDebugVariableValues] = useState<Record<string, string>>({});

  const debugVariableValuesLatest = useLatest(debugVariableValues);

  const streamAbortRef = useRef<AbortController | null>(null);
  const visionFileInputRef = useRef<HTMLInputElement | null>(null);

  const promptBraceKeys = useMemo(
    () => extractDoubleBraceVariableKeys(orch.systemPrompt),
    [orch.systemPrompt],
  );

  /** 补全列表：提示词里已闭合的 {{k}} ∪ 变量表行，避免同步帧之间漏掉已配置项 */
  const editorDefinedVariableKeys = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const k of promptBraceKeys) {
      if (!seen.has(k)) {
        seen.add(k);
        out.push(k);
      }
    }
    for (const row of orch.promptVariables ?? []) {
      const k = row.key.trim();
      if (k.length === 0 || seen.has(k)) {
        continue;
      }
      seen.add(k);
      out.push(k);
    }
    return out;
  }, [promptBraceKeys, orch.promptVariables]);

  useLayoutEffect(() => {
    setOrch((prev) => {
      const next = syncPromptVariablesToBraceKeys(prev.systemPrompt, prev.promptVariables ?? [], newId);
      const cur = prev.promptVariables ?? [];
      if (
        cur.length === next.length &&
        cur.every((r, i) => r.id === next[i]?.id && r.key === next[i]?.key && r.label === next[i]?.label)
      ) {
        return prev;
      }
      return { ...prev, promptVariables: next };
    });
  }, [orch.systemPrompt, orch.promptVariables, setOrch]);

  useEffect(() => {
    if (!orch.visionEnabled) {
      setPendingVisionDataUrls([]);
    }
  }, [orch.visionEnabled]);

  useEffect(() => {
    setPendingVisionDataUrls((prev) => prev.slice(0, orch.visionMaxImages));
  }, [orch.visionMaxImages]);

  const promptVariablesSyncKey = useMemo(
    () => JSON.stringify(orch.promptVariables ?? []),
    [orch.promptVariables],
  );

  useEffect(() => {
    const rows = orch.promptVariables ?? [];
    setDebugVariableValues((prev) => {
      const next: Record<string, string> = { ...prev };
      for (const v of rows) {
        if (!(v.key in next)) {
          next[v.key] = '';
        }
      }
      for (const k of Object.keys(next)) {
        if (!rows.some((v) => v.key === k)) {
          delete next[k];
        }
      }
      return next;
    });
  }, [promptVariablesSyncKey, orch.promptVariables]);

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
    setIsDatasetPickerOpen(true);
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

  // const addPromptVariable = () => {
  //   persistOrch((prev) => {
  //     const existing = new Set((prev.promptVariables ?? []).map((v) => v.key));
  //     let key = 'input';
  //     let n = 0;
  //     while (existing.has(key)) {
  //       n += 1;
  //       key = `var_${n}`;
  //     }
  //     return {
  //       ...prev,
  //       promptVariables: [...(prev.promptVariables ?? []), { id: newId(), key }],
  //     };
  //   });
  // };

  const removePromptVariable = (rowId: string) => {
    const row = (orchLatest.current?.promptVariables ?? []).find((r) => r.id === rowId);
    const k = row?.key.trim() ?? '';
    persistOrch((prev) => {
      let systemPrompt = prev.systemPrompt;
      if (k && isValidPromptVariableKey(k)) {
        systemPrompt = stripDoubleBracePlaceholdersForKey(systemPrompt, k);
      }
      return {
        ...prev,
        systemPrompt,
        promptVariables: (prev.promptVariables ?? []).filter((r) => r.id !== rowId),
      };
    });
  };

  const patchPromptVariable = (rowId: string, patch: Partial<Pick<WorkflowChatbotPromptVariable, 'key' | 'label'>>) => {
    const rowBefore = (orchLatest.current?.promptVariables ?? []).find((r) => r.id === rowId);
    const oldKey = rowBefore?.key;

    persistOrch((prev) => {
      let systemPrompt = prev.systemPrompt;
      if (oldKey && typeof patch.key === 'string') {
        const nk = patch.key.trim();
        if (nk && nk !== oldKey && isValidPromptVariableKey(oldKey) && isValidPromptVariableKey(nk)) {
          systemPrompt = replaceDoubleBraceKeyInPrompt(systemPrompt, oldKey, nk);
        }
      }
      return {
        ...prev,
        systemPrompt,
        promptVariables: (prev.promptVariables ?? []).map((row) => {
          if (row.id !== rowId) {
            return row;
          }
          const nextKey = typeof patch.key === 'string' ? patch.key.trim() : row.key;
          const nextLabel = patch.label !== undefined ? String(patch.label).trim() : row.label ?? '';
          return {
            ...row,
            key: nextKey,
            label: nextLabel.length > 0 ? nextLabel : undefined,
          };
        }),
      };
    });

    if (oldKey && typeof patch.key === 'string' && patch.key.trim() !== oldKey) {
      const nk = patch.key.trim();
      setDebugVariableValues((prev) => {
        const next = { ...prev };
        next[nk] = prev[oldKey] ?? '';
        delete next[oldKey];
        return next;
      });
    }
  };

  const addPromptVariablesFromKeys = (keys: readonly string[]) => {
    persistOrch((prev) => {
      const existing = new Set((prev.promptVariables ?? []).map((v) => v.key));
      const additions: WorkflowChatbotPromptVariable[] = [];
      for (const raw of keys) {
        const k = raw.trim();
        if (!isValidPromptVariableKey(k) || existing.has(k)) {
          continue;
        }
        existing.add(k);
        additions.push({ id: newId(), key: k });
      }
      if (additions.length === 0) {
        return prev;
      }
      return {
        ...prev,
        promptVariables: [...(prev.promptVariables ?? []), ...additions],
      };
    });
  };

  const handleVisionFilesChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) {
      return;
    }
    const o = orchLatest.current ?? orch;
    if (!o.visionEnabled) {
      event.target.value = '';
      return;
    }
    const max = o.visionMaxImages;
    const fileList = Array.from(files);
    event.target.value = '';

    const additions: string[] = [];
    let prepareError = '';
    for (const file of fileList) {
      if (additions.length >= max) {
        break;
      }
      try {
        const prepared = await prepareImageForAnalyze(file);
        additions.push(prepared.dataUrl);
      } catch (err) {
        const message = err instanceof Error ? err.message : '图片处理失败';
        if (!prepareError) {
          prepareError = message;
        }
      }
    }
    if (additions.length === 0) {
      if (prepareError) {
        setSendError(prepareError);
      }
      return;
    }
    setPendingVisionDataUrls((prev) => [...prev, ...additions].slice(0, max));
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

    const o = orchLatest.current ?? orch;
    const imageDataUrls =
      o.visionEnabled && pendingVisionDataUrls.length > 0
        ? pendingVisionDataUrls.slice(0, o.visionMaxImages)
        : undefined;

    const userLine: ChatLine = {
      id: newId(),
      role: 'user',
      content: text,
      imageCount: imageDataUrls?.length,
    };
    const assistantId = newId();
    setMessages((m) => [...m, userLine, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      const token = await ensureKnowledgeDatasetAuthToken();
      if (!token.trim()) {
        throw new Error('需要开发 JWT（知识库鉴权）；请从其它页完成登录或检查后端 /api/dev/token。');
      }

      let contextBlock = '';
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

      const dv = debugVariableValuesLatest.current ?? {};
      const values: Record<string, string> = {};
      for (const v of o.promptVariables ?? []) {
        values[v.key] = dv[v.key] ?? '';
      }
      const baseSystem = o.systemPrompt.trim() || '你是帮助用户的助手。';
      const resolvedSystem = applyPromptVariables(baseSystem, values);

      const augmented = [
        resolvedSystem,
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
        body: JSON.stringify({
          prompt: augmented,
          sessionId,
          ...(imageDataUrls?.length ? { imageDataUrls } : {}),
        }),
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
        onerror(err) {
          const detail =
            err instanceof Error
              ? err.message
              : typeof err === 'object' && err !== null && 'message' in err
                ? String((err as { message?: unknown }).message)
                : String(err);
          throw new Error(detail.trim() ? `流式连接中断：${detail}` : '流式连接中断');
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
      if (completed) {
        setPendingVisionDataUrls([]);
      }
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
      <KnowledgeDatasetPickerDialog
        open={isDatasetPickerOpen}
        onOpenChange={setIsDatasetPickerOpen}
        committedDatasetIds={orch.datasetIds}
        datasets={datasets}
        isLoading={isDatasetsLoading}
        errorMessage={datasetsError}
        onRefresh={refreshDatasets}
        onConfirm={(datasetIds) => persistOrch((prev) => ({ ...prev, datasetIds: [...datasetIds] }))}
        titleHint="可多选；Top K 与 Rerank 请在「召回设置」中配置。"
      />

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
                      content="重排序模型将根据候选文档列表与用户问题语义匹配度进行重新排序，从而改进语义排序的结果"
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
                  <PanelInfoHint content="用于筛选与用户问题相似度最高的文本片段。系统同时会根据选用模型上下文窗口大小动态调整分段数量。" />
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
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
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
          <button
            type="button"
            disabled
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white"
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
                <label className="text-sm font-medium text-slate-800 flex items-center gap-1" htmlFor="chatbot-system-prompt">
                  提示词{' '}
                  <PanelInfoHint content="提示词用于对 AI 的回复做出一系列指令和约束。可插入表单变量，例如 {{input}}。这段提示词不会被最终用户所看到。" />
                </label>
                
                {/* 这里是一个提示词生成器 */}
                {/* <button
                  type="button"
                  disabled
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-400"
                  title="后续接入"
                >
                  ✨ 生成
                </button> */}
              </div>

              <ChatbotPromptEditor
                id="chatbot-system-prompt"
                value={orch.systemPrompt}
                onChange={(v) => {
                  setOrch((o) => ({ ...o, systemPrompt: v }));
                  debouncedPersistPrompt(v);
                }}
                onBlurPersist={(v) => {
                  if (!appId) {
                    return;
                  }
                  updateWorkflowAppChatbotOrchestration(appId, (p) => ({
                    ...p,
                    systemPrompt: v,
                    promptVariables: syncPromptVariablesToBraceKeys(v, p.promptVariables ?? [], newId),
                  }));
                }}
                definedVariableKeys={editorDefinedVariableKeys}
                onAddVariables={addPromptVariablesFromKeys}
                maxLength={6000}
                rows={6}
                placeholder="例如：你是助手。用户主题是 {{topic}}。请结合知识库回答。"
              />

              <p className="pointer-events-none absolute bottom-3 left-3 z-30 text-xs text-slate-500">
                {orch.systemPrompt.length} / 6000
              </p>
            </div>

            {promptBraceKeys.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-sm font-medium text-slate-800">
                    变量
                    <PanelInfoHint content="变量将以表单形式让用户在对话前填写，用户填写的表单内容将自动替换提示词中的变量。" />
                  </span>
                </div>
                <ul className="mt-3 space-y-2">
                  {(orch.promptVariables ?? []).map((row) => {
                    const keyInvalid = row.key.length > 0 && !isValidPromptVariableKey(row.key);
                    return (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-1 shadow-sm sm:flex-nowrap"
                      >
                        <IconBraceVar className="shrink-0" />
                        <input
                          type="text"
                          value={row.key}
                          onChange={(e) => patchPromptVariable(row.id, { key: e.target.value })}
                          placeholder="标识，如 input"
                          className="min-w-[88px] max-w-[160px] flex-1 border-0 bg-transparent px-0 py-0.5 text-sm font-medium text-[#1D2939] outline-none ring-0 placeholder:text-slate-400 focus:ring-0"
                          spellCheck={false}
                        />
                        <input
                          type="text"
                          value={row.label ?? ''}
                          onChange={(e) => patchPromptVariable(row.id, { label: e.target.value })}
                          placeholder="展示名（可选）"
                          className="min-w-[100px] flex-1 rounded-md border border-slate-200/80 bg-slate-50/80 px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-sky-300"
                        />
                        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                          REQUIRED
                        </span>
                        <button
                          type="button"
                          onClick={() => removePromptVariable(row.id)}
                          className="ml-auto shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 hover:text-red-600 hover:border-red-600"
                        >
                          删除
                        </button>
                        {keyInvalid ? (
                          <span className="w-full text-[11px] text-rose-600">
                            标识须匹配：字母或下划线开头，仅字母、数字、下划线，最长 64 字符。
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">知识库</span>
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
                  <option value="auto">自动</option>
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

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-sm font-medium text-slate-800">
                  视觉
                  <PanelInfoHint content="开启后，调试区可附带图片一并发送给模型（多模态）；默认单轮最多 3 张，可在下方调节。" />
                </span>
                <PanelToggle
                  checked={orch.visionEnabled}
                  onChange={(next) =>
                    persistOrch((prev) => ({
                      ...prev,
                      visionEnabled: next,
                    }))
                  }
                />
              </div>
              {orch.visionEnabled ? (
                <div className="border-t border-slate-200/80 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-slate-600">单轮最多图片张数</span>
                    <div className="min-w-[200px] flex-1">
                      <PanelSliderInput
                        min={1}
                        max={10}
                        step={1}
                        value={orch.visionMaxImages}
                        onChange={(v) => {
                          persistOrch((prev) => {
                            if (v === null) {
                              return prev;
                            }
                            return {
                              ...prev,
                              visionMaxImages: Math.min(10, Math.max(1, Math.round(v))),
                            };
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white p-4 lg:p-5">
          <h2 className="text-base font-semibold text-slate-900">调试与预览</h2>
          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_8px_28px_-20px_rgba(14,116,144,0.35)] backdrop-blur">
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="relative flex min-h-0 flex-1">
                <div className="soft-scrollbar h-full w-full space-y-4 overflow-y-auto bg-gradient-to-b from-white via-slate-50/35 to-cyan-50/20 pb-8 pt-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  {messages.length === 0 ? (
                    <div className="mx-auto mt-4 max-w-5xl px-3 text-center">
                      <h3 className="font-display text-lg text-slate-800 md:text-xl">调试对话</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-500">
                        输入问题后发送：将先走知识库检索（multiWay + Rerank），再注入 Prompt 并流式生成。
                        {orch.visionEnabled
                          ? ' 开启视觉后可在下方添加图片一并发送（data URL，单张不宜过大）。'
                          : ''}
                      </p>
                    </div>
                  ) : (
                    messages.map((line) => (
                      <div
                        key={line.id}
                        className={`flex ${line.role === 'user' ? 'justify-end mr-3' : 'justify-start ml-3'}`}
                      >
                        <article
                          className={`max-w-[80%] rounded-2xl border text-sm shadow-sm md:text-[15px] ${
                            line.role === 'user'
                              ? 'border-cyan-200/90 bg-cyan-50/95 px-3.5 py-2.5 text-ink'
                              : 'border-slate-200/90 bg-white px-3.5 py-2.5 text-slate-700'
                          }`}
                        >
                          {!line.content && line.role === 'assistant' && isSending ? (
                            <span className="inline-flex items-center gap-1 text-slate-500">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:120ms]" />
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:240ms]" />
                            </span>
                          ) : (
                            <div className="leading-relaxed">
                              <div className="whitespace-pre-wrap">{line.content}</div>
                              {line.role === 'user' && line.imageCount ? (
                                <div className="mt-1 text-[11px] font-medium text-slate-600">
                                  附图 ×{line.imageCount}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </article>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            {sendError ? <p className="border-t border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">{sendError}</p> : null}
            <div className="mt-3 shrink-0 border-t border-slate-200/80 p-3">
              {promptBraceKeys.length > 0 ? (
                <div className="mb-3 rounded-lg border border-cyan-100/80 bg-cyan-50/40 px-2.5 py-2">
                  {/* <p className="text-[11px] font-semibold text-slate-800">调试：变量取值</p> */}
                  {/* <p className="mt-0.5 text-[10px] leading-relaxed text-slate-600">
                    发送前会把提示词中的 <code className="font-mono">{'{{key}}'}</code> 替换为下方内容；留空则替换为空字符串。未在列表中的占位符不会被替换。
                  </p> */}
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {(orch.promptVariables ?? []).map((v) => (
                      <label key={v.id} className="block min-w-0">
                        <span className="flex flex-wrap items-baseline gap-x-1 text-[11px] text-slate-700">
                          <span className="font-medium">{v.label || v.key}</span>
                          {/* <code className="font-mono text-[10px] text-slate-500">{`{{${v.key}}}`}</code> */}
                        </span>
                        <input
                          type="text"
                          value={debugVariableValues[v.key] ?? ''}
                          onChange={(e) =>
                            setDebugVariableValues((prev) => ({
                              ...prev,
                              [v.key]: e.target.value,
                            }))
                          }
                          disabled={isSending}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-cyan-400 disabled:opacity-50"
                          placeholder={`请填写变量${v.key}`}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
              {orch.visionEnabled ? (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <input
                    ref={visionFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => void handleVisionFilesChange(e)}
                  />
                  <button
                    type="button"
                    onClick={() => visionFileInputRef.current?.click()}
                    disabled={
                      isSending || pendingVisionDataUrls.length >= orch.visionMaxImages
                    }
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    添加图片 ({pendingVisionDataUrls.length}/{orch.visionMaxImages})
                  </button>
                  {pendingVisionDataUrls.map((url, index) => (
                    <span
                      key={`${url.slice(0, 48)}-${index}`}
                      className="relative inline-block h-10 w-10 overflow-hidden rounded-md border border-slate-200"
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() =>
                          setPendingVisionDataUrls((prev) => prev.filter((_, i) => i !== index))
                        }
                        className="absolute inset-0 flex items-center justify-center bg-slate-900/50 text-xs font-bold text-white opacity-0 transition hover:opacity-100"
                        aria-label="移除图片"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="relative w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 shadow-[0_8px_24px_-12px_rgba(14,116,144,0.18),inset_0_1px_0_rgba(255,255,255,0.8)] transition focus-within:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-200/70">
                <div className="flex items-center gap-2">
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
                    className="min-w-0 flex-1 border-none bg-transparent py-1 text-sm leading-6 text-slate-800 outline-none disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={isSending || !debugInput.trim()}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-600 to-sky-600 text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 disabled:shadow-none"
                    aria-label="发送消息"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M5 12h14" />
                      <path d="m13 6 6 6-6 6" />
                    </svg>
                  </button>
                </div>
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
