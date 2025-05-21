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

export type RecentDialogueItem = {
  id: string;
  sessionId: string;
  updatedAt: number;
  userContent: string;
};

export type PromptQuickAction = {
  key: 'file' | 'image' | 'translate' | 'takeout';
  label: string;
};

export type LocalChatMessage = TakeoutChatMessage & {
  imagePreviewUrl?: string;
  imageName?: string;
  fileName?: string;
  fileExtension?: string;
  fileSize?: number;
  isStreamingText?: boolean;
};

export type AssistantTypewriterOptions = {
  replaceLastAssistant?: boolean;
  onComplete?: () => void;
};

export type TimelineStageLabelMap = Record<TimelineEvent['stage'], string>;
export type TimelineStatusLabelMap = Record<TimelineEvent['status'], string>;

export type LatestQuestionGetter = (chatMessages: ChatMessage[]) => string;