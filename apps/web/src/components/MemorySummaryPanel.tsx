import { useEffect, useMemo, useState } from 'react';
import { requestSessionSnapshot } from '../lib/api';
import { usePlaygroundStore } from '../store/playgroundStore';

export const MemorySummaryPanel = () => {
  const { sessionId, authToken, timelineEvents } = usePlaygroundStore();
  const [memorySummary, setMemorySummary] = useState('');
  const [memorySummaryUpdatedAt, setMemorySummaryUpdatedAt] = useState<number | null>(null);
  const [messageCount, setMessageCount] = useState(0);

  const latestEventId = useMemo(() => {
    return timelineEvents.length > 0 ? timelineEvents[timelineEvents.length - 1]?.eventId || 0 : 0;
  }, [timelineEvents]);

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
        setMessageCount(snapshot.messages.length);
      } catch {
        if (!canceled) {
          setMessageCount(0);
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
      <h2 className="font-display text-lg text-ink">Long Context Memory</h2>
      <p className="mt-1 text-sm text-slate-600">滚动摘要 + Token 预算编排已启用，优先保留近期多轮并压缩历史。</p>
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <p>Session messages: {messageCount}</p>
        <p>Summary tokens(est): {Math.max(0, Math.ceil(memorySummary.length / 3.8))}</p>
        <p>
          Summary updated:{' '}
          {memorySummaryUpdatedAt ? new Date(memorySummaryUpdatedAt).toLocaleTimeString() : 'not yet'}
        </p>
      </div>
      <div className="mt-3 max-h-28 overflow-auto rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600">
        {memorySummary || '摘要将在会话轮次达到阈值后自动生成。'}
      </div>
    </section>
  );
};
