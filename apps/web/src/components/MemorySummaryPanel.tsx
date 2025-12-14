import { useEffect, useMemo, useState } from 'react';
import { STAGE_LABEL_MAP, STATUS_LABEL_MAP } from '../features/chat-stream/constants';
import { MEMORY_RECENT_MESSAGES_WINDOW } from '../features/chat-stream/memoryDisplayConstants';
import { getPlaygroundWorkflowChatStreamSessionId } from '../features/workflow/chatbotAugmentedStreamPrompt';
import type { SessionSnapshotResponse } from '../lib/api';
import { requestSessionSnapshot } from '../lib/api';
import { usePlaygroundStore } from '../store/playgroundStore';

const MESSAGE_PREVIEW_CHARS = 220;

const truncateMessagePreview = (raw: string, maxLen: number): string => {
  const t = raw.replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) {
    return t;
  }
  return `${t.slice(0, maxLen)}…`;
};

export const MemorySummaryPanel = () => {
  const { sessionId, authToken, publishedChatbotWorkflowAppId, timelineEvents, memoryMetrics, isStreaming } =
    usePlaygroundStore();

  const snapshotSessionId = useMemo(
    () => getPlaygroundWorkflowChatStreamSessionId(sessionId, publishedChatbotWorkflowAppId),
    [sessionId, publishedChatbotWorkflowAppId],
  );
  const [memorySummary, setMemorySummary] = useState('');
  const [memorySummaryUpdatedAt, setMemorySummaryUpdatedAt] = useState<number | null>(null);
  const [snapshotMessages, setSnapshotMessages] = useState<SessionSnapshotResponse['messages']>([]);

  const latestEventId = useMemo(() => {
    return timelineEvents.length > 0 ? timelineEvents[timelineEvents.length - 1]?.eventId || 0 : 0;
  }, [timelineEvents]);

  const currentTimelineEvent = useMemo(
    () => timelineEvents[timelineEvents.length - 1],
    [timelineEvents],
  );

  const recentWindow = useMemo(
    () => snapshotMessages.slice(-MEMORY_RECENT_MESSAGES_WINDOW),
    [snapshotMessages],
  );

  const olderOutsideWindowCount = useMemo(
    () => Math.max(0, snapshotMessages.length - MEMORY_RECENT_MESSAGES_WINDOW),
    [snapshotMessages],
  );

  const recentWindowStartIndex = useMemo(
    () => Math.max(1, snapshotMessages.length - recentWindow.length + 1),
    [snapshotMessages.length, recentWindow.length],
  );

  useEffect(() => {
    if (!authToken) {
      return;
    }

    let canceled = false;

    const load = async () => {
      try {
        const snapshot = await requestSessionSnapshot({ sessionId: snapshotSessionId, authToken });
        if (canceled) {
          return;
        }

        setMemorySummary(snapshot.memorySummary || '');
        setMemorySummaryUpdatedAt(snapshot.memorySummaryUpdatedAt);
        setSnapshotMessages(snapshot.messages);
      } catch {
        if (!canceled) {
          setMemorySummary('');
          setMemorySummaryUpdatedAt(null);
          setSnapshotMessages([]);
        }
      }
    };

    void load();
    return () => {
      canceled = true;
    };
  }, [authToken, latestEventId, snapshotSessionId]);

  return (
    <section className="rounded-2xl bg-white/80 p-5 shadow-sm backdrop-blur">
      <h2 className="font-display text-lg text-ink font-bold">长上下文记忆</h2>
      <p className="mt-1 text-sm text-slate-600">
        下图自上而下对应服务端编排：先读滚动摘要，再在「近期窗口」里拼接末尾多轮；最后仍受 token 预算约束。
      </p>

      <div className="mt-3 flex flex-wrap items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
        <span aria-hidden className="mt-0.5 shrink-0">
          <span className={`inline-block h-2 w-2 rounded-full ${isStreaming ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p>
            <span className="font-medium text-slate-800">编排快照</span>
            {' · '}
            会话 <b>{memoryMetrics.messageCount}</b> 条 · 摘要阈值 <b>{memoryMetrics.summaryTriggerMessageCount}</b> 条 ·
            近期窗口 <b>{MEMORY_RECENT_MESSAGES_WINDOW}</b> 条
            {memoryMetrics.isSummaryThresholdReached ? (
              <span className="text-emerald-700"> · 已达摘要阈值</span>
            ) : (
              <span className="text-amber-700"> · 未达摘要阈值</span>
            )}
          </p>
          {currentTimelineEvent && (
            <p className="truncate text-slate-500">
              {STAGE_LABEL_MAP[currentTimelineEvent.stage]} / {STATUS_LABEL_MAP[currentTimelineEvent.status]}:{' '}
              {currentTimelineEvent.message}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-xl border border-amber-200/80 border-l-4 border-l-amber-400 bg-amber-50/40 p-3">
          <h3 className="text-sm font-semibold text-amber-950">① 滚动摘要（长期记忆）</h3>
          <p className="mt-1 text-xs text-amber-900/80">
            当消息条数达到阈值后，比「近期窗口」更早的多轮会合并进这一段，而不是逐条塞进模型。
          </p>
          <p className="mt-1 text-xs text-slate-500">
            最近更新:{' '}
            <span className="font-medium text-slate-700">
              {memorySummaryUpdatedAt ? new Date(memorySummaryUpdatedAt).toLocaleString('zh-CN', { hour12: false }) : '暂无'}
            </span>
          </p>
          <div className="mt-2 max-h-36 overflow-auto rounded-lg border border-amber-100/90 bg-white/90 p-3 text-xs leading-relaxed text-slate-700">
            {memorySummary.trim().length > 0 ? (
              memorySummary
            ) : (
              <span className="text-slate-500">尚无摘要。达到阈值并继续对话后，较早轮次会逐步压入本层。</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-sky-200/80 border-l-4 border-l-sky-500 bg-sky-50/35 p-3">
          <h3 className="text-sm font-semibold text-sky-950">② 近期窗口（送进模型的多轮候选）</h3>
          <p className="mt-1 text-xs text-sky-900/85">
            始终对应会话末尾至多 {MEMORY_RECENT_MESSAGES_WINDOW} 条。服务端仍会按 token 预算从<strong>最新</strong>一条往前截取，实际进模型的条数可能更少。
          </p>
          {recentWindow.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">当前快照里没有消息。发送一条对话后会在此列出末尾多轮。</p>
          ) : (
            <ol className="mt-2 max-h-52 space-y-2 overflow-auto pr-1" start={recentWindowStartIndex}>
              {recentWindow.map((message, index) => {
                const displayIndex = recentWindowStartIndex + index;
                const attachmentHint =
                  message.attachments && message.attachments.length > 0
                    ? ` · 含 ${message.attachments.length} 个附件`
                    : '';
                const key = `${displayIndex}-${message.role}-${message.timestamp ?? index}`;

                return (
                  <li key={key} className="rounded-lg border border-sky-100/90 bg-white/90 px-3 py-2 text-xs text-slate-700">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-semibold text-slate-900">
                        {displayIndex}. {message.role === 'user' ? '用户' : '助手'}
                      </span>
                      {attachmentHint ? <span className="text-slate-500">{attachmentHint}</span> : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-slate-600">
                      {truncateMessagePreview(message.content, MESSAGE_PREVIEW_CHARS)}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
          <h3 className="text-sm font-semibold text-slate-800">③ 其余与会话 token</h3>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
            {olderOutsideWindowCount > 0 ? (
              <li>
                另有 <b>{olderOutsideWindowCount}</b> 条更早消息不在上方「近期窗口」列表里。
                {memoryMetrics.isSummaryThresholdReached
                  ? ' 在已达摘要阈值的情况下，它们会由第 ① 层滚动摘要承接。'
                  : ' 当前未达摘要阈值：它们仍保存在会话中，但不会出现在末尾窗口预览内。'}
              </li>
            ) : (
              <li>当前会话条数不超过近期窗口上限，没有「更早且被挤出窗口」的多轮。</li>
            )}
            <li>
              估算 token：会话正文约 <b>{memoryMetrics.conversationTokensEstimate}</b>，摘要约{' '}
              <b>{memoryMetrics.summaryTokensEstimate}</b>，输入侧预算约 <b>{memoryMetrics.budgetTokensEstimate}</b>（与控制器刷新逻辑一致，仅供理解体量）。
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
};
