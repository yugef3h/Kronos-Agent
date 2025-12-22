import type { BaseMessage } from '@langchain/core/messages';
import type { LangChainStreamEvent } from '../chat/streamEventTypes.js';
import { createTimelineEvent } from '../chat/timelineEvents.js';
import { safeStringify } from '../chat/safeStringify.js';

type MessageTextPart = {
  text?: unknown;
};

// 读取消息类型
const readMessageType = (message: BaseMessage): string | undefined => {
  const maybeGetType = (message as { _getType?: unknown })._getType;
  if (typeof maybeGetType === 'function') {
    return maybeGetType.call(message) as string;
  }

  const maybeType = (message as { type?: unknown }).type;
  return typeof maybeType === 'string' ? maybeType : undefined;
};

// 读取消息文本
export const readMessageText = (message: BaseMessage | undefined): string => {
  if (!message) return '';
  const raw: unknown = message.content;

  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          const maybeText = (item as MessageTextPart).text;
          return typeof maybeText === 'string' ? maybeText : '';
        }
        return '';
      })
      .join('');
  }

  if (typeof raw === 'object' && raw !== null) {
    const maybeText = (raw as MessageTextPart).text;
    return typeof maybeText === 'string' ? maybeText : '';
  }

  return '';
};

// 读取工具调用
const readToolCalls = (message: BaseMessage) => {
  const maybeToolCalls = (message as { tool_calls?: unknown }).tool_calls;
  if (!Array.isArray(maybeToolCalls)) {
    return [];
  }

  const parsed: Array<{ name: string; args?: unknown; id?: string }> = [];

  for (const item of maybeToolCalls) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const call = item as { name?: unknown; args?: unknown; id?: unknown };
    if (typeof call.name !== 'string') {
      continue;
    }

    parsed.push({
      name: call.name,
      args: call.args,
      id: typeof call.id === 'string' ? call.id : undefined,
    });
  }

  return parsed;
};

// 将 LangGraph 更新映射为时间线事件
export const mapLangGraphUpdateToTimelineEvents = (
  nodeName: string,
  messages: BaseMessage[],
): LangChainStreamEvent[] => {
  const events: LangChainStreamEvent[] = [];

  for (const message of messages) {
    const type = readMessageType(message);

    if (nodeName === 'agent' && (type === 'ai' || type === 'assistant')) {
      const toolCalls = readToolCalls(message);
      for (const call of toolCalls) {
        events.push(
          createTimelineEvent(
            'tool',
            'start',
            `工具 ${call.name} 开始执行。`,
            call.name,
            safeStringify(call.args ?? {}),
          ),
        );
      }
    }

    if (nodeName === 'tools' && type === 'tool') {
      const toolName = (message as { name?: unknown }).name;
      const resolvedName = typeof toolName === 'string' ? toolName : 'unknown_tool';
      const output = readMessageText(message);
      const statusType = (message as { status?: unknown }).status;
      const failed = statusType === 'error';

      events.push(
        createTimelineEvent(
          'tool',
          'end',
          failed ? `工具 ${resolvedName} 执行失败。` : `工具 ${resolvedName} 执行完成。`,
          resolvedName,
          undefined,
          failed ? undefined : output,
          failed ? output || 'tool execution failed' : undefined,
        ),
      );
    }
  }

  return events;
};

const isHumanMessage = (message: BaseMessage): boolean => {
  const type = readMessageType(message);
  return type === 'human' || type === 'user';
};

const isAssistantMessage = (message: BaseMessage): boolean => {
  const type = readMessageType(message);
  return type === 'ai' || type === 'assistant';
};

/** 全量 state 中最后一条助手消息（含历史轮次，勿单独用于流式 delta）。 */
export const findLatestAssistantText = (messages: BaseMessage[]): string => {
  const lastAssistant = [...messages].reverse().find((msg) => isAssistantMessage(msg));
  return readMessageText(lastAssistant);
};

/**
 * 仅取「最后一条用户消息之后」的助手正文，避免 LangGraph checkpoint 把上一轮回复当成本轮增量。
 */
export const findCurrentTurnAssistantText = (messages: BaseMessage[]): string => {
  let lastHumanIndex = -1;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (isHumanMessage(messages[index]!)) {
      lastHumanIndex = index;
      break;
    }
  }

  const afterHuman = messages.slice(lastHumanIndex + 1);
  const turnAssistants = afterHuman.filter((msg) => isAssistantMessage(msg));
  const lastTurnAssistant = turnAssistants[turnAssistants.length - 1];

  return readMessageText(lastTurnAssistant);
};
