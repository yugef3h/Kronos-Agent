import type { TimelineEvent } from '../../types/chat';
import { getRenderableImageSource } from './utils/chatStreamHelpers';
import type { AssistantInvocationSummary, LocalChatMessage, PlaygroundModality } from './types';

export const createAssistantInvocation = (
  partial?: Partial<AssistantInvocationSummary>,
): AssistantInvocationSummary => ({
  tools: partial?.tools ? [...new Set(partial.tools)] : [],
  modalities: partial?.modalities ? [...new Set(partial.modalities)] : [],
});

export const mergeAssistantInvocation = (
  current: AssistantInvocationSummary | undefined,
  patch: Partial<AssistantInvocationSummary>,
): AssistantInvocationSummary => ({
  tools: [...new Set([...(current?.tools ?? []), ...(patch.tools ?? [])])],
  modalities: [...new Set([...(current?.modalities ?? []), ...(patch.modalities ?? [])])],
});

export const extractToolNamesFromTimeline = (events: TimelineEvent[]): string[] => {
  const names = events
    .filter((event) => event.stage === 'tool' && event.status === 'end' && event.toolName)
    .map((event) => event.toolName as string);

  return [...new Set(names)];
};

export const inferModalitiesBeforeAssistant = (
  messages: LocalChatMessage[],
  assistantIndex: number,
): PlaygroundModality[] => {
  const modalities: PlaygroundModality[] = [];

  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'assistant') {
      break;
    }

    if (message.role !== 'user') {
      continue;
    }

    if (getRenderableImageSource(message)) {
      modalities.push('image');
    }

    if (message.fileName) {
      modalities.push('file');
    }
  }

  return [...new Set(modalities)];
};

export const resolveAssistantInvocation = (
  message: LocalChatMessage,
  messages: LocalChatMessage[],
  messageIndex: number,
): AssistantInvocationSummary | null => {
  if (message.role !== 'assistant') {
    return null;
  }

  const inferredModalities: PlaygroundModality[] = [];

  if (message.flowType === 'takeout') {
    inferredModalities.push('takeout');
  }

  inferredModalities.push(...inferModalitiesBeforeAssistant(messages, messageIndex));

  const summary = mergeAssistantInvocation(message.assistantInvocation, {
    modalities: inferredModalities,
  });

  if (summary.tools.length === 0 && summary.modalities.length === 0) {
    return null;
  }

  return summary;
};

export const TOOL_INVOCATION_LABELS: Record<string, string> = {
  web_search: '网页搜索',
};

export const MODALITY_INVOCATION_LABELS: Record<PlaygroundModality, string> = {
  image: '图片',
  file: '文件',
  takeout: '外卖',
};
