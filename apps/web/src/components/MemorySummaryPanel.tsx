import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPlaygroundWorkflowChatStreamSessionId } from '../features/workflow/chatbotAugmentedStreamPrompt';
import { requestSessionSnapshot } from '../lib/api';
import { usePlaygroundStore } from '../store/playgroundStore';

export const MemorySummaryPanel = () => {
  const { sessionId, authToken, publishedChatbotWorkflowAppId, memoryMetrics, isStreaming } = usePlaygroundStore();

  const snapshotSessionId = useMemo(
    () => getPlaygroundWorkflowChatStreamSessionId(sessionId, publishedChatbotWorkflowAppId),
    [sessionId, publishedChatbotWorkflowAppId],
  );
  const [memorySummary, setMemorySummary] = useState('');
  const [memorySummaryUpdatedAt, setMemorySummaryUpdatedAt] = useState<number | null>(null);

  const loadSnapshot = useCallback(
    async (signal?: { canceled: boolean }) => {
      if (!authToken) {
        return;
      }

      try {
        const snapshot = await requestSessionSnapshot({ sessionId: snapshotSessionId, authToken });
        if (signal?.canceled) {
          return;
        }

        setMemorySummary(snapshot.memorySummary || '');
        setMemorySummaryUpdatedAt(snapshot.memorySummaryUpdatedAt);
      } catch {
        if (!signal?.canceled) {
          setMemorySummary('');
          setMemorySummaryUpdatedAt(null);
        }
      }
    },
    [authToken, snapshotSessionId],
  );

  useEffect(() => {
    const signal = { canceled: false };
    void loadSnapshot(signal);
    return () => {
      signal.canceled = true;
    };
  }, [loadSnapshot, memoryMetrics.messageCount, memoryMetrics.summaryTokensEstimate, snapshotSessionId]);

  useEffect(() => {
    if (isStreaming || !authToken) {
      return undefined;
    }

    const signal = { canceled: false };
    const timer = window.setTimeout(() => {
      void loadSnapshot(signal);
    }, 320);

    return () => {
      signal.canceled = true;
      window.clearTimeout(timer);
    };
  }, [authToken, isStreaming, loadSnapshot]);

  return (
    <section className="rounded-2xl bg-white/80 p-5 shadow-sm backdrop-blur">
      <h2 className="font-display text-lg text-ink font-bold">长上下文记忆</h2>
      <p className="mt-1 text-sm text-slate-600">
        滚动摘要：超过阈值后，较早多轮会压缩进本段，再与近期对话一起参与模型请求（服务端确定性合并，非单独调用模型写摘要）。
      </p>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span aria-hidden>
          <span className={`inline-block h-2 w-2 rounded-full ${isStreaming ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`} />
        </span>
        <span>
          会话 <b className="text-slate-700">{memoryMetrics.messageCount}</b> 条 · 摘要阈值{' '}
          <b className="text-slate-700">{memoryMetrics.summaryTriggerMessageCount}</b> 条
        </span>
      </p>

      <div className="mt-4 rounded-xl border border-amber-200/80 border-l-4 border-l-amber-400 bg-amber-50/40 p-3">
        <h3 className="text-sm font-semibold text-amber-950">滚动摘要（长期记忆）</h3>
        <p className="mt-1 text-xs text-slate-500">
          最近更新:{' '}
          <span className="font-medium text-slate-700">
            {memorySummaryUpdatedAt ? new Date(memorySummaryUpdatedAt).toLocaleString('zh-CN', { hour12: false }) : '暂无'}
          </span>
        </p>
        <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-amber-100/90 bg-white/90 p-3 text-xs leading-relaxed text-slate-700">
          {memorySummary.trim().length > 0 ? (
            memorySummary
          ) : (
            <span className="text-slate-500">
              尚无摘要。满阈值后由服务端在助手回复落盘时写入；若条数已够仍为空，请确认已重启 apps/server 并结束一轮完整回复。
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
