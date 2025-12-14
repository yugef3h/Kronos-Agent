import { useEffect, useMemo, useState } from 'react';
import { STAGE_LABEL_MAP, STATUS_LABEL_MAP } from '../features/chat-stream/constants';
import { requestSessionSnapshot } from '../lib/api';
import { usePlaygroundStore } from '../store/playgroundStore';

export const MemorySummaryPanel = () => {
  const { sessionId, authToken, timelineEvents, memoryMetrics, isStreaming } = usePlaygroundStore();
  const [memorySummary, setMemorySummary] = useState('');
  const [memorySummaryUpdatedAt, setMemorySummaryUpdatedAt] = useState<number | null>(null);

  const latestEventId = useMemo(() => {
    return timelineEvents.length > 0 ? timelineEvents[timelineEvents.length - 1]?.eventId || 0 : 0;
  }, [timelineEvents]);

  const currentTimelineEvent = useMemo(
    () => timelineEvents[timelineEvents.length - 1],
    [timelineEvents],
  );

  useEffect(() => {
    if (!authToken) {
      return;
    }

    let canceled = false;

    const load = async () => {
      try {
        const snapshot = await requestSessionSnapshot({ sessionId, authToken });
        if (canceled) {
          return;
        }

        setMemorySummary(snapshot.memorySummary || '');
        setMemorySummaryUpdatedAt(snapshot.memorySummaryUpdatedAt);
      } catch {
        if (!canceled) {
          setMemorySummary('');
        }
      }
    };

    void load();
    return () => {
      canceled = true;
    };
  }, [authToken, latestEventId, sessionId]);

  return (
    <section className="rounded-2xl bg-white/80 p-5 shadow-sm backdrop-blur">
      <h2 className="font-display text-lg text-ink font-bold">长上下文记忆</h2>
      <p className="mt-1 text-sm text-slate-600">滚动摘要与 Token 预算编排已启用，优先保留近期多轮并压缩历史。</p>

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span aria-hidden>
            <span className={`inline-block h-2 w-2 rounded-full ${isStreaming ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`} />
          </span>
          <span>
            消息数: <b className="text-slate-800">{memoryMetrics.messageCount}</b> / {memoryMetrics.summaryTriggerMessageCount}
          </span>
          <span>
            会话 token: <b className="text-slate-800">{memoryMetrics.conversationTokensEstimate}</b>
          </span>
          <span>
            摘要 token: <b className="text-slate-800">{memoryMetrics.summaryTokensEstimate}</b>
          </span>
          <span>
            输入预算: <b className="text-slate-800">{memoryMetrics.budgetTokensEstimate}</b>
          </span>
          <span className={`font-medium ${memoryMetrics.isSummaryThresholdReached ? 'text-emerald-700' : 'text-amber-700'}`}>
            摘要: {memoryMetrics.isSummaryThresholdReached ? '已触发' : '未触发'}
          </span>
        </div>

        {currentTimelineEvent && (
          <p className="mt-1 truncate text-slate-500">
            {STAGE_LABEL_MAP[currentTimelineEvent.stage]} / {STATUS_LABEL_MAP[currentTimelineEvent.status]}: {currentTimelineEvent.message}
          </p>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        摘要更新时间:{' '}
        <span className="font-medium text-slate-700">
          {memorySummaryUpdatedAt ? new Date(memorySummaryUpdatedAt).toLocaleString('zh-CN', { hour12: false }) : '暂无'}
        </span>
      </p>

      <div className="mt-2 max-h-28 overflow-auto rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600">
        {memorySummary || '摘要将在会话轮次达到阈值后自动生成。'}
      </div>
    </section>
  );
};
