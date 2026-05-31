import { useMemo } from 'react';
import { usePlaygroundStore } from '../store/playgroundStore';
import type { TimelineEvent } from '../types/chat';

const STAGE_LABELS: Record<TimelineEvent['stage'], string> = {
  plan: '规划',
  tool: '工具',
  reason: '推理',
};

const STAGE_COLORS: Record<TimelineEvent['stage'], string> = {
  plan: 'border-cyan-300 bg-cyan-50',
  tool: 'border-amber-300 bg-amber-50',
  reason: 'border-purple-300 bg-purple-50',
};

const STAGE_DOT_COLORS: Record<TimelineEvent['stage'], string> = {
  plan: 'bg-cyan-500',
  tool: 'bg-amber-500',
  reason: 'bg-purple-500',
};

const STAGE_DOT_ANIMATION: Record<TimelineEvent['status'], string> = {
  start: 'animate-pulse',
  end: '',
  info: '',
};

const GroupedTimelineEvents = ({ events }: { events: TimelineEvent[] }) => {
  const grouped = useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = { plan: [], tool: [], reason: [] };
    for (const e of events) {
      groups[e.stage]?.push(e);
    }
    return groups;
  }, [events]);

  const stages: TimelineEvent['stage'][] = ['plan', 'tool', 'reason'];

  return (
    <div className="mt-3 space-y-3">
      {stages.map((stage) => {
        const stageEvents = grouped[stage];
        if (stageEvents?.length === 0) {
          return (
            <div key={stage} className={`rounded-lg border px-3 py-2 text-xs text-slate-400 ${STAGE_COLORS[stage]}`}>
              <span className="font-medium">{STAGE_LABELS[stage]}</span>
              <span className="ml-2">暂无事件</span>
            </div>
          );
        }

        return (
          <div key={stage} className={`rounded-lg border ${STAGE_COLORS[stage]} overflow-hidden`}>
            <div className="px-3 py-2 flex items-center gap-2 border-b border-black/5">
              <span className={`h-2 w-2 rounded-full ${STAGE_DOT_COLORS[stage]}`} />
              <span className="text-xs font-semibold">{STAGE_LABELS[stage]}</span>
              <span className="text-[10px] text-slate-500">({stageEvents!.length})</span>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-black/5">
              {stageEvents!.map((event) => (
                <div key={event.eventId} className="px-3 py-1.5 flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${STAGE_DOT_COLORS[stage]} ${STAGE_DOT_ANIMATION[event.status]}`} />
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-700 break-all">{event.message}</span>
                    {event.toolName && (
                      <span className="ml-1 text-[10px] text-slate-400">({event.toolName})</span>
                    )}
                    {event.toolError && (
                      <div className="mt-0.5 text-[10px] text-red-500 break-all">{event.toolError}</div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(event.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const AgentOrchestratorPanel = () => {
  const timelineEvents = usePlaygroundStore((state) => state.timelineEvents);
  const isStreaming = usePlaygroundStore((state) => state.isStreaming);

  return (
    <section className="rounded-2xl bg-white/80 p-5 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">多 Agent 编排</h2>
        {isStreaming && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 animate-pulse">
            运行中
          </span>
        )}
      </div>

      {timelineEvents.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          发送消息后将在此展示 Agent 工作流程：Plan（规划）→ Tool（工具调用）→ Reason（推理）
        </p>
      ) : (
        <GroupedTimelineEvents events={timelineEvents} />
      )}
    </section>
  );
};
