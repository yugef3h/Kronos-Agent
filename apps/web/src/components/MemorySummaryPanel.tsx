import { usePlaygroundStore } from '../store/playgroundStore';

export const MemorySummaryPanel = () => {
  const { memoryMetrics, memorySummary, memorySummaryUpdatedAt, isStreaming } = usePlaygroundStore();

  return (
    <section className="rounded-2xl bg-white/80 p-5 shadow-sm backdrop-blur">
      <h2 className="font-display text-lg text-ink font-bold">长上下文记忆</h2>
      <p className="mt-1 text-sm text-slate-600">
        与左侧对话共用会话快照；Network 里请筛选 <code className="text-xs">/api/session/</code>（不是 snapshot 字样）。
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
              尚无摘要。需走普通 chat-stream 且满阈值；外卖编排不会写入滚动摘要。结束一轮完整回复后，在 Network 中应能看到对{' '}
              <code className="text-xs">/api/session/</code> 的请求。
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
