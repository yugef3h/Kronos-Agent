import type { ChatMessage, TimelineEvent } from '../../types/chat';
import type { TakeoutChatMessage } from '../agent-tools/takeout';

export type TokenizerModule = {
  encode: (text: string) => Iterable<number>;
};

export type MemoryLiveMetrics = {
  messageCount: number;
  conversationTokensEstimate: number;
  summaryTokensEstimate: number;
  budgetTokensEstimate: number;
  summaryTriggerMessageCount: number;
  isSummaryThresholdReached: boolean;
};

export type PlaygroundHistorySurface = 'default' | 'published';

export type RecentDialogueItem = {
  id: string;
  /** 服务端快照键（落盘文件名），可能与页签 sessionId 不同 */
  sessionId: string;
  updatedAt: number;
  userContent: string;
  playgroundSurface: PlaygroundHistorySurface;
  basePlaygroundSessionId: string;
  publishedChatbotWorkflowAppId: string | null;
};

export type PromptQuickAction = {
  key: 'file' | 'image' | 'translate' | 'takeout';
  label: string;
};

import type { PlaygroundModality, PlaygroundToolName } from './invocationRegistry';

export type { PlaygroundModality, PlaygroundToolName };

export type AssistantInvocationSummary = {
  tools: PlaygroundToolName[];
  modalities: PlaygroundModality[];
};

export type MessageSendStatus = 'pending' | 'sent' | 'failed';

export type LocalChatMessage = TakeoutChatMessage & {
  /** 客户端稳定 key，用于列表渲染 */
  clientMessageId?: string;
  /** 用户消息发送状态（乐观更新） */
  sendStatus?: MessageSendStatus;
  /** 占位 assistant，等待 SSE 接管 */
  isOptimistic?: boolean;
  imagePreviewUrl?: string;
  imageName?: string;
  fileName?: string;
  fileExtension?: string;
  fileSize?: number;
  isStreamingText?: boolean;
  assistantInvocation?: AssistantInvocationSummary;
};

export type AssistantTypewriterOptions = {
  replaceLastAssistant?: boolean;
  assistantInvocation?: AssistantInvocationSummary;
  onComplete?: () => void;
};

export type TimelineStageLabelMap = Record<TimelineEvent['stage'], string>;
export type TimelineStatusLabelMap = Record<TimelineEvent['status'], string>;

export type LatestQuestionGetter = (chatMessages: ChatMessage[]) => string;