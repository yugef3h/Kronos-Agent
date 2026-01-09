import { useEffect, useId, useMemo, useState } from 'react';

import type { TimelineEvent } from '../../../types/chat';
import type { TimelineStageLabelMap, TimelineStatusLabelMap } from '../types';
import { summarizeTimelineHeader } from './chatTimelineFoldUtils';

type ChatTimelineFoldProps = {
  timelineEvents: TimelineEvent[];
  currentTimelineEvent: TimelineEvent | undefined;
  stageLabelMap: TimelineStageLabelMap;
  statusLabelMap: TimelineStatusLabelMap;
  isActive: boolean;
};

const STAGE_STYLES: Record<TimelineEvent['stage'], string> = {
  plan: 'bg-cyan-100 text-cyan-800',
  tool: 'bg-emerald-100 text-emerald-800',
  reason: 'bg-violet-100 text-violet-800',
};

const STATUS_STYLES: Record<TimelineEvent['status'], string> = {
  start: 'bg-amber-100 text-amber-800',
  end: 'bg-slate-100 text-slate-600',
  info: 'bg-sky-100 text-sky-800',
};

type TimelineEventListProps = {
  id: string;
  labelledBy: string;
  timelineEvents: TimelineEvent[];
  stageLabelMap: TimelineStageLabelMap;
  statusLabelMap: TimelineStatusLabelMap;
};

const TimelineEventList = ({
  id,
  labelledBy,
  timelineEvents,
  stageLabelMap,
  statusLabelMap,
}: TimelineEventListProps) => (
  <div
    id={id}
    role="region"
    aria-labelledby={labelledBy}
    className="soft-scrollbar max-h-48 space-y-1.5 overflow-y-auto border-t border-slate-100 px-3 pb-3 pt-1"
  >
    {timelineEvents.map((event) => (
      <article
        key={event.eventId}
        className="rounded-xl border border-slate-100 bg-slate-50/80 px-2.5 py-2 text-xs"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 font-semibold ${STAGE_STYLES[event.stage]}`}>
            {stageLabelMap[event.stage]}
          </span>
          <span className={`rounded px-1.5 py-0.5 font-medium ${STATUS_STYLES[event.status]}`}>
            {statusLabelMap[event.status]}
          </span>
          {event.toolName ? (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
              {event.toolName}
            </span>
          ) : null}
        </div>
        <p className="mt-1 leading-relaxed text-slate-700">{event.message}</p>
        {event.toolInput ? (
          <p className="mt-1 line-clamp-2 text-slate-500">input: {event.toolInput}</p>
        ) : null}
        {event.toolOutput ? (
          <p className="mt-1 line-clamp-3 text-slate-500">output: {event.toolOutput}</p>
        ) : null}
        {event.toolError ? (
          <p className="mt-1 text-rose-600">error: {event.toolError}</p>
        ) : null}
      </article>
    ))}
  </div>
);

export const ChatTimelineFold = ({
  timelineEvents,
  currentTimelineEvent,
  stageLabelMap,
  statusLabelMap,
  isActive,
}: ChatTimelineFoldProps) => {
  const panelId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const [userCollapsed, setUserCollapsed] = useState(false);

  const headerText = useMemo(
    () => summarizeTimelineHeader(timelineEvents, currentTimelineEvent, stageLabelMap, isActive),
    [currentTimelineEvent, isActive, stageLabelMap, timelineEvents],
  );

  const showPulse = isActive && currentTimelineEvent?.status === 'start';

  useEffect(() => {
    if (isActive && !userCollapsed) {
      setIsExpanded(true);
    }
  }, [isActive, userCollapsed]);

  useEffect(() => {
    if (!isActive) {
      setUserCollapsed(false);
    }
  }, [isActive]);

  if (timelineEvents.length === 0) {
    return null;
  }

  const toggleExpanded = () => {
    setIsExpanded((previous) => {
      const next = !previous;
      if (!next && isActive) {
        setUserCollapsed(true);
      }
      return next;
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white/95 shadow-sm backdrop-blur">
      <button
        type="button"
        id={`${panelId}-trigger`}
        aria-expanded={isExpanded}
        aria-controls={`${panelId}-panel`}
        onClick={toggleExpanded}
        className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left transition hover:bg-slate-50/80"
      >
        <span
          className={`inline-flex h-2 w-2 shrink-0 rounded-full bg-cyan-500 ${showPulse ? 'animate-pulse' : ''}`}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{headerText}</span>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          {timelineEvents.length}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isExpanded ? (
        <TimelineEventList
          id={`${panelId}-panel`}
          labelledBy={`${panelId}-trigger`}
          timelineEvents={timelineEvents}
          stageLabelMap={stageLabelMap}
          statusLabelMap={statusLabelMap}
        />
      ) : null}
    </div>
  );
};
