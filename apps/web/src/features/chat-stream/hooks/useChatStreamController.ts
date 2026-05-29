import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useShallow } from 'zustand/react/shallow';

import { requestDevToken } from '../../../lib/api';
import { usePlaygroundStore } from '../../../store/playgroundStore';
import { mergeAssistantInvocation } from '../assistantInvocation';
import type { TimelineEvent } from '../../../types/chat';
import type { ValueSelector, VariableOption } from '../../../domains/workflow/editor/panels/llm-panel/types';
import { shouldShowHotTopics } from '../../../components/chatHotTopics';
import {
  type TakeoutCombo,
  type TakeoutFlowState,
  type TakeoutFood,
  type TakeoutModalState,
  useTakeoutTool,
} from '../../agent-tools/takeout';
import type { FileSelectionResult } from '../../agent-tools/file';
import type { ImageSelectionResult } from '../../agent-tools/image';
import {
  PROMPT_QUICK_ACTIONS,
  STAGE_LABEL_MAP,
  STATUS_LABEL_MAP,
} from '../constants';
import type {
  LocalChatMessage,
  MemoryLiveMetrics,
  PromptQuickAction,
  RecentDialogueItem,
} from '../types';
import { useAssistantTypewriter } from './useAssistantTypewriter';
import { usePlaygroundChatStream } from './usePlaygroundChatStream';
import { usePlaygroundHistoryActions } from './usePlaygroundHistoryActions';
import { usePlaygroundHistoryPanel } from './usePlaygroundHistoryPanel';
import { usePlaygroundHotTopics } from './usePlaygroundHotTopics';
import { usePlaygroundMediaInputs } from './usePlaygroundMediaInputs';
import { usePlaygroundMemoryMetrics } from './usePlaygroundMemoryMetrics';
import { usePlaygroundPanelUi } from './usePlaygroundPanelUi';
import { usePlaygroundSendPrompt } from './usePlaygroundSendPrompt';
import { usePlaygroundSessionHydration } from './usePlaygroundSessionHydration';
import { usePlaygroundTakeoutQuickAction } from './usePlaygroundTakeoutQuickAction';
import { usePublishedChatbotPlayground } from './usePublishedChatbotPlayground';
import type { WorkflowAppRecord } from '../../../domains/workflow/app/workflowAppStore';
import { getPlaygroundWorkflowChatStreamSessionId } from '../../../domains/workflow/app/chatbotAugmentedStreamPrompt';

export type UseChatStreamControllerResult = {
  canSend: boolean;
  currentTimelineEvent: TimelineEvent | undefined;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  formatTimestamp: (timestamp: number) => string;
  handleDocumentFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleExplainFileClick: () => void;
  handleExplainImageClick: () => void;
  handleHistoryItemClick: (target: RecentDialogueItem) => void;
  handleStartNewConversation: () => void;
  handleHotTopicClick: (topic: string) => void;
  handleImageFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handlePromptKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleQuickActionClick: (action: PromptQuickAction['key']) => void;
  handleTakeoutCancel: (flowId: number) => void;
  confirmHistorySessionSwitch: () => void;
  cancelHistorySessionSwitch: () => void;
  historyPanelRef: MutableRefObject<HTMLDivElement | null>;
  historySwitchConfirmTarget: RecentDialogueItem | null;
  hotTopics: string[];
  imageInputRef: MutableRefObject<HTMLInputElement | null>;
  isAnalyzingImage: boolean;
  isAwaitingTakeoutFollowup: boolean;
  isHistoryLoading: boolean;
  isHistoryOpen: boolean;
  isOrchestrating: boolean;
  isStreaming: boolean;
  isTakeoutAgreementChecked: boolean;
  isTakeoutLoading: boolean;
  memoryMetrics: MemoryLiveMetrics;
  messageListRef: MutableRefObject<HTMLDivElement | null>;
  messages: LocalChatMessage[];
  modalState: TakeoutModalState;
  onAgreementCheckedChange: (nextValue: boolean) => void;
  onCloseAuthorization: () => void;
  onCloseCombo: () => void;
  onClosePayment: () => void;
  onConfirmAgreement: (flowId: number) => Promise<void>;
  onConfirmSelection: (flowId: number) => Promise<void>;
  onOpenAuthorizationModal: (flowId: number) => void;
  onOpenPaymentModal: (flowId: number) => void;
  onPaymentPasswordChange: (flowId: number, rawValue: string) => void;
  onSelectCombo: (flowId: number, combo: TakeoutCombo) => void;
  onSelectFood: (flowId: number, food: TakeoutFood) => void;
  pendingFile: FileSelectionResult | null;
  pendingImage: ImageSelectionResult | null;
  paymentInputRef: MutableRefObject<HTMLInputElement | null>;
  prompt: string;
  promptQuickActions: readonly PromptQuickAction[];
  promptTextareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  recentDialogues: RecentDialogueItem[];
  renderPlainMessageContent: (message: LocalChatMessage) => ReactNode;
  scrollToBottom: () => void;
  sendPrompt: (overridePrompt?: string) => Promise<void>;
  sessionId: string;
  setPendingFile: Dispatch<SetStateAction<FileSelectionResult | null>>;
  setPendingImage: Dispatch<SetStateAction<ImageSelectionResult | null>>;
  setPrompt: Dispatch<SetStateAction<string>>;
  showHotTopics: boolean;
  showScrollToBottom: boolean;
  showTakeoutScrollHint: boolean;
  stageLabelMap: Record<TimelineEvent['stage'], string>;
  statusLabelMap: Record<TimelineEvent['status'], string>;
  timelineEvents: TimelineEvent[];
  takeoutFlowState: TakeoutFlowState;
  takeoutFoodsScrollerRef: MutableRefObject<HTMLDivElement | null>;
  takeoutLoadingLabel: string;
  toggleHistoryPanel: () => void;
  publishedChatbotWorkflowApps: WorkflowAppRecord[];
  publishedChatbotWorkflowAppId: string | null;
  publishedChatbotRagValueSelector: ValueSelector;
  publishedChatbotRagVariableOptions: VariableOption[];
  handlePublishedChatbotRagVariableChange: (value: ValueSelector) => void;
  clearPublishedChatbotRagSelection: () => void;
  isWorkflowBlankCreateDialogOpen: boolean;
  closeWorkflowBlankCreateDialog: () => void;
  handleWorkflowBlankAppCreated: (app: WorkflowAppRecord) => void;
};

export const useChatStreamController = (): UseChatStreamControllerResult => {
  const {
    sessionId,
    authToken,
    timelineEvents,
    chatMessages: messages,
    chatPrompt: prompt,
    pendingFile,
    pendingImage,
    isStreaming,
    isOrchestrating,
    isAnalyzingImage,
    isAwaitingTakeoutFollowup,
    memoryMetrics,
    takeoutFlowState: persistedTakeoutFlowState,
    switchPlaygroundHistorySession,
    setSessionId,
    resetChatPanelState,
    setAuthToken,
    setLatestUserQuestion,
    appendTimelineEvent,
    clearTimelineEvents,
    setChatMessages: setMessages,
    setChatPrompt: setPrompt,
    setPendingFile,
    setPendingImage,
    setIsStreaming,
    setIsOrchestrating,
    setIsAnalyzingImage,
    setIsAwaitingTakeoutFollowup,
    setMemoryMetrics,
    setMemorySummary,
    setMemorySummaryUpdatedAt,
    setTakeoutFlowState,
    publishedChatbotWorkflowAppId,
    setPublishedChatbotWorkflowAppId,
  } = usePlaygroundStore(
    useShallow((state) => ({
      sessionId: state.sessionId,
      authToken: state.authToken,
      timelineEvents: state.timelineEvents,
      chatMessages: state.chatMessages,
      chatPrompt: state.chatPrompt,
      pendingFile: state.pendingFile,
      pendingImage: state.pendingImage,
      isStreaming: state.isStreaming,
      isOrchestrating: state.isOrchestrating,
      isAnalyzingImage: state.isAnalyzingImage,
      isAwaitingTakeoutFollowup: state.isAwaitingTakeoutFollowup,
      memoryMetrics: state.memoryMetrics,
      takeoutFlowState: state.takeoutFlowState,
      switchPlaygroundHistorySession: state.switchPlaygroundHistorySession,
      setSessionId: state.setSessionId,
      resetChatPanelState: state.resetChatPanelState,
      setAuthToken: state.setAuthToken,
      setLatestUserQuestion: state.setLatestUserQuestion,
      appendTimelineEvent: state.appendTimelineEvent,
      clearTimelineEvents: state.clearTimelineEvents,
      setChatMessages: state.setChatMessages,
      setChatPrompt: state.setChatPrompt,
      setPendingFile: state.setPendingFile,
      setPendingImage: state.setPendingImage,
      setIsStreaming: state.setIsStreaming,
      setIsOrchestrating: state.setIsOrchestrating,
      setIsAnalyzingImage: state.setIsAnalyzingImage,
      setIsAwaitingTakeoutFollowup: state.setIsAwaitingTakeoutFollowup,
      setMemoryMetrics: state.setMemoryMetrics,
      setMemorySummary: state.setMemorySummary,
      setMemorySummaryUpdatedAt: state.setMemorySummaryUpdatedAt,
      setTakeoutFlowState: state.setTakeoutFlowState,
      publishedChatbotWorkflowAppId: state.publishedChatbotWorkflowAppId,
      setPublishedChatbotWorkflowAppId: state.setPublishedChatbotWorkflowAppId,
    })),
  );

  const [, setIsGeneratingToken] = useState(false);
  const [, setTokenMessage] = useState('');
  const activeRequestIdRef = useRef(0);
  const interruptedRequestIdsRef = useRef<Set<number>>(new Set());
  const activeControllerRef = useRef<AbortController | null>(null);
  const pendingImageUploadRef = useRef<Promise<string | null> | null>(null);
  const streamRefs = useMemo(
    () => ({
      activeRequestIdRef,
      interruptedRequestIdsRef,
      activeControllerRef,
    }),
    [],
  );

  const playgroundChatStreamSessionId = useMemo(
    () => getPlaygroundWorkflowChatStreamSessionId(sessionId, publishedChatbotWorkflowAppId),
    [sessionId, publishedChatbotWorkflowAppId],
  );

  const {
    messageListRef,
    promptTextareaRef,
    renderPlainMessageContent,
    scrollToBottom,
    showScrollToBottom,
    stickToBottomRef,
  } = usePlaygroundPanelUi({ messages, prompt });

  const {
    streamFlushTimerRef,
    resetAssistantStreamingState,
    flushRemainingAssistantBuffer,
    startAssistantTypewriter,
    startStreamingAssistantMessage,
    appendStreamingContent,
    completeStreamingContent,
    abortStreamingAssistantMessage,
  } = useAssistantTypewriter({
    setMessages,
    setIsStreaming,
    activeControllerRef,
  });

  const patchLastAssistantInvocation = useCallback((patch: Parameters<typeof mergeAssistantInvocation>[1]) => {
    setMessages((prev) => {
      const draft = [...prev];
      const last = draft[draft.length - 1];

      if (!last || last.role !== 'assistant') {
        return prev;
      }

      draft[draft.length - 1] = {
        ...last,
        assistantInvocation: mergeAssistantInvocation(last.assistantInvocation, patch),
      };

      return draft;
    });
  }, [setMessages]);

  const {
    flowState: takeoutFlowState,
    modalState,
    isTakeoutAgreementChecked,
    setIsTakeoutAgreementChecked,
    foodsScrollerRef: takeoutFoodsScrollerRef,
    paymentInputRef,
    showTakeoutScrollHint,
    startTakeoutConversation,
    openTakeoutAuthorizationModal,
    closeTakeoutAuthorizationModal,
    handleTakeoutAgreement,
    handleTakeoutCancel,
    handleTakeoutSelectFood,
    closeTakeoutComboModal,
    handleTakeoutSelectCombo,
    handleTakeoutConfirmSelection,
    openTakeoutPaymentModal,
    closeTakeoutPaymentModal,
    handleTakeoutPaymentPasswordChange,
  } = useTakeoutTool({
    messages,
    setMessages,
    authToken,
    sessionId,
    flowState: persistedTakeoutFlowState,
    setFlowState: setTakeoutFlowState,
  });

  const hasRestorableDraft = useMemo(() => {
    return (
      messages.length > 0
      || prompt.trim().length > 0
      || pendingFile !== null
      || pendingImage !== null
      || persistedTakeoutFlowState.flowId !== 0
    );
  }, [messages.length, pendingFile, pendingImage, prompt, persistedTakeoutFlowState.flowId]);

  const {
    applySnapshotMemory,
    hydrateSessionMessages,
  } = usePlaygroundSessionHydration({
    authToken,
    playgroundChatStreamSessionId,
    hasRestorableDraft,
    setMessages,
    setLatestUserQuestion,
    setMemoryMetrics,
    setMemorySummary,
    setMemorySummaryUpdatedAt,
  });

  const hotTopics = usePlaygroundHotTopics(authToken);

  const {
    historyPanelRef,
    historySwitchConfirmTarget,
    isHistoryLoading,
    isHistoryOpen,
    recentDialogues,
    refreshRecentSessions,
    setHistorySwitchConfirmTarget,
    setIsHistoryOpen,
    toggleHistoryPanel,
  } = usePlaygroundHistoryPanel(authToken);

  const { executePlaygroundChatStream } = usePlaygroundChatStream({
    authToken,
    activeRequestIdRef,
    interruptedRequestIdsRef,
    activeControllerRef,
    appendStreamingContent,
    appendTimelineEvent,
    abortStreamingAssistantMessage,
    completeStreamingContent,
    setMessages,
    setIsStreaming,
    patchLastAssistantInvocation,
  });

  const formatTimestamp = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
  }, []);

  const canSend = useMemo(() => {
    return prompt.trim().length > 0 || pendingImage !== null || pendingFile !== null;
  }, [pendingFile, pendingImage, prompt]);

  const showHotTopics = useMemo(() => {
    return shouldShowHotTopics({
      messageCount: messages.length,
      prompt,
      hasPendingImage: pendingImage !== null,
      hasPendingFile: pendingFile !== null,
    });
  }, [messages.length, pendingFile, pendingImage, prompt]);

  const currentTimelineEvent = useMemo(
    () => timelineEvents[timelineEvents.length - 1],
    [timelineEvents],
  );

  const isTakeoutLoading = useMemo(() => {
    return isOrchestrating || takeoutFlowState.isCallingApi;
  }, [isOrchestrating, takeoutFlowState.isCallingApi]);

  const takeoutLoadingLabel = useMemo(() => {
    if (!takeoutFlowState.flowId) {
      return '正在搜索';
    }

    return takeoutFlowState.isFoodListVisible ? '正在更新外卖流程' : '正在搜索';
  }, [takeoutFlowState.flowId, takeoutFlowState.isFoodListVisible]);

  const latestMessageSignature = useMemo(() => {
    const lastMessage = messages[messages.length - 1];
    return [
      messages.length,
      lastMessage?.role || '',
      lastMessage?.content || '',
      lastMessage?.flowType || '',
      lastMessage?.takeoutMessageType || '',
      lastMessage?.isIncomplete ? '1' : '0',
    ].join('|');
  }, [messages]);

  const latestTimelineEventId = useMemo(() => {
    return timelineEvents.length > 0 ? timelineEvents[timelineEvents.length - 1]?.eventId || 0 : 0;
  }, [timelineEvents]);

  const { metricsRefreshTimerRef, refreshMemoryMetrics, scheduleMemoryMetricsRefresh, cancelAllScheduling } = usePlaygroundMemoryMetrics({
    authToken,
    playgroundChatStreamSessionId,
    isStreaming,
    isOrchestrating,
    isAnalyzingImage,
    latestTimelineEventId,
    latestMessageSignature,
    applySnapshotMemory,
  });

  const generateDevToken = useCallback(async () => {
    setIsGeneratingToken(true);
    setTokenMessage('');

    try {
      const data = await requestDevToken();
      setAuthToken(data.token);
      setTokenMessage(`测试 JWT 已自动签发（有效期 ${data.expiresIn}）`);
    } catch {
      setTokenMessage('自动签发失败，请确认 server 已启动且为非生产环境');
    } finally {
      setIsGeneratingToken(false);
    }
  }, [setAuthToken]);

  const {
    clearPublishedChatbotRagSelection,
    closeWorkflowBlankCreateDialog,
    handlePublishedChatbotRagVariableChange,
    handleWorkflowBlankAppCreated,
    isWorkflowBlankCreateDialogOpen,
    publishedChatbotApps,
    publishedChatbotRagValueSelector,
    publishedChatbotRagVariableOptions,
  } = usePublishedChatbotPlayground({
    authToken,
    sessionId,
    publishedChatbotWorkflowAppId,
    setPublishedChatbotWorkflowAppId,
    streamRefs,
    flushRemainingAssistantBuffer,
    abortStreamingAssistantMessage,
    resetAssistantStreamingState,
    setMessages,
    setIsStreaming,
    setIsOrchestrating,
    clearTimelineEvents,
    setHistorySwitchConfirmTarget,
    hydrateSessionMessages,
    refreshMemoryMetrics,
  });

  const { sendPrompt } = usePlaygroundSendPrompt({
    prompt,
    canSend,
    authToken,
    sessionId,
    playgroundChatStreamSessionId,
    publishedChatbotWorkflowAppId,
    pendingImage,
    pendingFile,
    messages,
    isStreaming,
    isOrchestrating,
    isAnalyzingImage,
    isAwaitingTakeoutFollowup,
    stickToBottomRef,
    pendingImageUploadRef,
    streamRefs,
    setMessages,
    setPrompt,
    setLatestUserQuestion,
    setPendingImage,
    setPendingFile,
    setIsAnalyzingImage,
    setIsOrchestrating,
    setIsAwaitingTakeoutFollowup,
    setIsStreaming,
    clearTimelineEvents,
    flushRemainingAssistantBuffer,
    abortStreamingAssistantMessage,
    resetAssistantStreamingState,
    startAssistantTypewriter,
    startStreamingAssistantMessage,
    executePlaygroundChatStream,
    startTakeoutConversation,
    scheduleMemoryMetricsRefresh,
  });

  const {
    fileInputRef,
    handleDocumentFileChange,
    handleExplainFileClick,
    handleExplainImageClick,
    handleImageFileChange,
    imageInputRef,
  } = usePlaygroundMediaInputs({
    authToken,
    prompt,
    pendingImage,
    pendingFile,
    promptTextareaRef,
    pendingImageUploadRef,
    setPendingFile,
    setPendingImage,
    startAssistantTypewriter,
    sendPrompt,
  });

  const {
    cancelHistorySessionSwitch,
    confirmHistorySessionSwitch,
    handleHistoryItemClick,
    handleStartNewConversation,
  } = usePlaygroundHistoryActions({
    sessionId,
    publishedChatbotWorkflowAppId,
    messages,
    hasRestorableDraft,
    streamRefs,
    resetAssistantStreamingState,
    setIsStreaming,
    setIsOrchestrating,
    setIsAwaitingTakeoutFollowup,
    clearTimelineEvents,
    switchPlaygroundHistorySession,
    resetChatPanelState,
    setSessionId,
    setIsHistoryOpen,
    setHistorySwitchConfirmTarget,
    historySwitchConfirmTarget,
    refreshRecentSessions,
  });

  const { handleQuickActionClick, takeoutQuickReplyTimerRef } = usePlaygroundTakeoutQuickAction({
    prompt,
    isStreaming,
    isOrchestrating,
    isAnalyzingImage,
    fileInputRef,
    imageInputRef,
    setMessages,
    setPrompt,
    setLatestUserQuestion,
    setIsAwaitingTakeoutFollowup,
    startAssistantTypewriter,
    scheduleMemoryMetricsRefresh,
  });

  useEffect(() => {
    setHistorySwitchConfirmTarget(null);
  }, [publishedChatbotWorkflowAppId, setHistorySwitchConfirmTarget]);

  useEffect(() => {
    if (!pendingImage) {
      pendingImageUploadRef.current = null;
    }
  }, [pendingImage]);

  useEffect(() => {
    if (!authToken) {
      void generateDevToken();
    }
  }, [authToken, generateDevToken]);

  useEffect(() => {
    const controllerRef = activeControllerRef;
    const takeoutTimerRef = takeoutQuickReplyTimerRef;
    const metricsTimerRef = metricsRefreshTimerRef;
    const flushTimerRef = streamFlushTimerRef;

    return () => {
      controllerRef.current?.abort();
      if (takeoutTimerRef.current !== null) {
        window.clearTimeout(takeoutTimerRef.current);
        takeoutTimerRef.current = null;
      }
      cancelAllScheduling();
      if (metricsTimerRef.current !== null) {
        window.clearTimeout(metricsTimerRef.current);
        metricsTimerRef.current = null;
      }
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, [cancelAllScheduling, metricsRefreshTimerRef, streamFlushTimerRef, takeoutQuickReplyTimerRef]);

  const handlePromptKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey && canSend) {
      event.preventDefault();
      void sendPrompt();
    }
  }, [canSend, sendPrompt]);

  const handleHotTopicClick = useCallback((topic: string) => {
    if (isStreaming || isOrchestrating || isAnalyzingImage || takeoutQuickReplyTimerRef.current !== null) {
      return;
    }

    void sendPrompt(topic);
  }, [isAnalyzingImage, isOrchestrating, isStreaming, sendPrompt, takeoutQuickReplyTimerRef]);

  return {
    canSend,
    currentTimelineEvent,
    confirmHistorySessionSwitch,
    cancelHistorySessionSwitch,
    fileInputRef,
    formatTimestamp,
    handleDocumentFileChange,
    handleExplainFileClick,
    handleExplainImageClick,
    handleHistoryItemClick,
    handleStartNewConversation,
    handleHotTopicClick,
    handleImageFileChange,
    handlePromptKeyDown,
    handleQuickActionClick,
    handleTakeoutCancel,
    historyPanelRef,
    historySwitchConfirmTarget,
    hotTopics,
    imageInputRef,
    isAnalyzingImage,
    isAwaitingTakeoutFollowup,
    isHistoryLoading,
    isHistoryOpen,
    isOrchestrating,
    isStreaming,
    isTakeoutAgreementChecked,
    isTakeoutLoading,
    memoryMetrics,
    messageListRef,
    messages,
    modalState,
    onAgreementCheckedChange: setIsTakeoutAgreementChecked,
    onCloseAuthorization: closeTakeoutAuthorizationModal,
    onCloseCombo: closeTakeoutComboModal,
    onClosePayment: closeTakeoutPaymentModal,
    onConfirmAgreement: handleTakeoutAgreement,
    onConfirmSelection: handleTakeoutConfirmSelection,
    onOpenAuthorizationModal: openTakeoutAuthorizationModal,
    onOpenPaymentModal: openTakeoutPaymentModal,
    onPaymentPasswordChange: handleTakeoutPaymentPasswordChange,
    onSelectCombo: handleTakeoutSelectCombo,
    onSelectFood: handleTakeoutSelectFood,
    pendingFile,
    pendingImage,
    paymentInputRef,
    prompt,
    promptQuickActions: PROMPT_QUICK_ACTIONS,
    promptTextareaRef,
    recentDialogues,
    renderPlainMessageContent,
    scrollToBottom,
    sendPrompt,
    sessionId,
    setPendingFile,
    setPendingImage,
    setPrompt,
    showHotTopics,
    showScrollToBottom,
    showTakeoutScrollHint,
    stageLabelMap: STAGE_LABEL_MAP,
    statusLabelMap: STATUS_LABEL_MAP,
    timelineEvents,
    takeoutFlowState,
    takeoutFoodsScrollerRef,
    takeoutLoadingLabel,
    toggleHistoryPanel,
    publishedChatbotWorkflowApps: publishedChatbotApps,
    publishedChatbotWorkflowAppId,
    publishedChatbotRagValueSelector,
    publishedChatbotRagVariableOptions,
    handlePublishedChatbotRagVariableChange,
    clearPublishedChatbotRagSelection,
    isWorkflowBlankCreateDialogOpen,
    closeWorkflowBlankCreateDialog,
    handleWorkflowBlankAppCreated,
  };
};
