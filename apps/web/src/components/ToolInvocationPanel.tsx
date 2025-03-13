import { usePlaygroundStore } from '../store/playgroundStore';

export const ToolInvocationPanel = () => {
  const { timelineEvents } = usePlaygroundStore();

  return (
    <section className="rounded-2xl bg-white/80 p-5 shadow-sm backdrop-blur">
      <h2 className="font-display text-lg text-ink">Tool Invocation Debugger</h2>
      <p className="mt-1 text-sm text-slate-600">用于展示 Agent 的 tool selection、input、output 与错误恢复。</p>

      <div className="mt-3 max-h-64 space-y-2 overflow-auto rounded-xl border border-slate-200 p-3 text-xs text-slate-700">
        {timelineEvents.length === 0 && <p>No timeline events yet. Send a prompt to inspect tool traces.</p>}

        {timelineEvents.map((event) => (
          <article key={event.eventId} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
            <div className="flex items-center gap-2">
              <span className="rounded bg-cyan-100 px-1.5 py-0.5 uppercase">{event.stage}</span>
              <span className="rounded bg-amber-100 px-1.5 py-0.5 uppercase">{event.status}</span>
              {event.toolName && <span className="rounded bg-emerald-100 px-1.5 py-0.5">{event.toolName}</span>}
            </div>
            <p className="mt-1 text-slate-700">{event.message}</p>
            {event.toolInput && <p className="mt-1 text-slate-500">input: {event.toolInput}</p>}
            {event.toolOutput && <p className="mt-1 text-slate-500">output: {event.toolOutput}</p>}
            {event.toolError && <p className="mt-1 text-rose-600">error: {event.toolError}</p>}
          </article>
        ))}
      </div>
    </section>
  );
};
