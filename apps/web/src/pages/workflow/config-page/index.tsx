import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';

import {
  createDefaultChatbotOrchestration,
  getWorkflowAppById,
} from '../../../features/workflow/workflowAppStore';

/**
 * Chatbot（`app.mode: chat`）编排页：自研 RAG 走现有 HTTP 契约（见 docs/Refactor_RAG_with_Langchain.md），
 * Phase 1+2 仅路由与 UI 骨架；检索 / 流式对话在后续 Phase 接入。
 */
export const WorkflowConfigPage = () => {
  const [searchParams] = useSearchParams();
  const appId = searchParams.get('appId')?.trim() ?? '';

  const app = appId ? getWorkflowAppById(appId) : undefined;

  const [systemPromptDraft, setSystemPromptDraft] = useState('');
  const [debugInput, setDebugInput] = useState('');

  useEffect(() => {
    if (!appId) {
      return;
    }
    const record = getWorkflowAppById(appId);
    if (!record) {
      return;
    }
    const initial = record.chatbotOrchestration ?? createDefaultChatbotOrchestration();
    setSystemPromptDraft(initial.systemPrompt);
  }, [appId]);

  if (!appId) {
    return <Navigate to="/workflow" replace />;
  }

  if (!app) {
    return <Navigate to="/workflow" replace />;
  }

  if (app.dsl.app.mode !== 'chat') {
    return <Navigate to={`/workflow/draft?appId=${encodeURIComponent(app.id)}`} replace />;
  }

  return (
    <div className="flex min-h-0 min-h-[calc(100vh-4rem)] w-full flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/workflow"
            className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            ← 应用
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{app.name}</p>
            <p className="text-xs text-slate-500">Chatbot 编排 · 自研检索契约</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 sm:inline">
            模型（后续接入）
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

      <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        {/* 左：编排 */}
        <section className="flex min-h-0 flex-col overflow-y-auto bg-white p-4 lg:p-5">
          <h2 className="text-base font-semibold text-slate-900">编排</h2>

          <div className="mt-4 space-y-6">
            <div>
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
              <textarea
                id="chatbot-system-prompt"
                value={systemPromptDraft}
                onChange={(e) => setSystemPromptDraft(e.target.value)}
                rows={10}
                maxLength={8000}
                placeholder="在这里写你的提示词，输入「{」插入变量、输入「/」插入提示内容块（后续支持）"
                className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-1 focus:ring-sky-300"
              />
              <p className="mt-1 text-xs text-slate-500">{systemPromptDraft.length} / 8000</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">变量</span>
                <button type="button" disabled className="text-xs font-medium text-slate-400">
                  ＋ 添加
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                变量能通过用户输入表单引入提示词或开场白；后续与「编排」数据模型对齐。
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">上下文（知识库）</span>
                <div className="flex items-center gap-2">
                  <Link
                    to="/rag"
                    className="text-xs font-medium text-sky-700 hover:text-sky-800"
                  >
                    召回设置
                  </Link>
                  <button type="button" disabled className="text-xs font-medium text-slate-400">
                    ＋ 添加
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                导入知识库作为上下文；检索走服务端自研链路（混合召回 + 启发式 Rerank，与知识库配置一致）。
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-600">元数据过滤</span>
                <select
                  disabled
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                  defaultValue="disabled"
                >
                  <option value="disabled">禁用</option>
                </select>
              </div>
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

        {/* 右：调试与预览 */}
        <section className="flex min-h-0 min-h-[320px] flex-col bg-white p-4 lg:min-h-0 lg:p-5">
          <h2 className="text-base font-semibold text-slate-900">调试与预览</h2>
          <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-slate-50/40">
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <p className="text-center text-sm text-slate-400">对话将显示在这里（Phase 4 接入流式输出）</p>
            </div>
            <div className="border-t border-slate-200 p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={debugInput}
                  onChange={(e) => setDebugInput(e.target.value)}
                  placeholder="和 Bot 聊天"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400"
                  disabled
                />
                <button
                  type="button"
                  disabled
                  className="shrink-0 rounded-xl bg-sky-600 px-3 py-2 text-sm font-medium text-white opacity-50"
                  aria-label="发送"
                >
                  ➤
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">
              <span aria-hidden>●</span> 编排骨架已就绪
            </span>
            <Link to="/rag" className="font-medium text-sky-700 hover:text-sky-800">
              管理 →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};
