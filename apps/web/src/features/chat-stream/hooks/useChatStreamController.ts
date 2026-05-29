import {
  Fragment,
  createElement,
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
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import {
  requestDevToken,
  requestFileAnalysis,
  requestImageRecognition,
  requestTakeoutOrchestration,
} from '../../../lib/api';
import { ensureKnowledgeDatasetAuthToken } from '../../../domains/knowledge/dataset-store';
import { createPlaygroundSessionId, usePlaygroundStore } from '../../../store/playgroundStore';
import {
  createAssistantInvocation,
  mergeAssistantInvocation,
} from '../assistantInvocation';
import type { TimelineEvent } from '../../../types/chat';
import type { ValueSelector, VariableOption } from '../../../domains/workflow/editor/panels/llm-panel/types';
import { shouldShowHotTopics } from '../../../components/chatHotTopics';
import {
  MOCK_ADDRESS,
  getTakeoutQuickActionPrompt,
  isTakeoutIntentPrompt,
  type TakeoutCombo,
  type TakeoutFlowState,
  type TakeoutFood,
  type TakeoutModalState,
  useTakeoutTool,
} from '../../agent-tools/takeout';
import {
  prepareFileForAnalyze,
  type FileSelectionResult,
} from '../../agent-tools/file';
import {
  prepareImageForAnalyze,
  resolveImageUrlForBackend,
  uploadImageToImgbb,
  type ImageSelectionResult,
} from '../../agent-tools/image';
import {
  FILE_DEFAULT_PROMPT,
  IMAGE_DEFAULT_PROMPT,
  MESSAGE_LIST_STICK_THRESHOLD_PX,
  PROMPT_QUICK_ACTIONS,
  STAGE_LABEL_MAP,
  STATUS_LABEL_MAP,
  TAKEOUT_QUICK_ACTION_REPLY,
  TAKEOUT_QUICK_ACTION_REPLY_DELAY_MS,
} from '../constants';
import type {
  LocalChatMessage,
  MemoryLiveMetrics,
  PromptQuickAction,
  RecentDialogueItem,
} from '../types';
import { markLastAssistantMessageIncomplete } from '../utils/chatStreamHelpers';
import { useAssistantTypewriter } from './useAssistantTypewriter';
import { usePlaygroundChatStream } from './usePlaygroundChatStream';
import { usePlaygroundHistoryPanel } from './usePlaygroundHistoryPanel';
import { usePlaygroundHotTopics } from './usePlaygroundHotTopics';
import { usePlaygroundMemoryMetrics } from './usePlaygroundMemoryMetrics';
import { usePlaygroundSessionHydration } from './usePlaygroundSessionHydration';
import {
  WORKFLOW_APPS_STORAGE_KEY,
  WORKFLOW_DRAFT_PREVIEW_STORAGE_PREFIX,
  listPublishedChatbotWorkflowApps,
  type WorkflowAppRecord,
} from '../../../domains/workflow/app/workflowAppStore';
import { getPlaygroundWorkflowChatStreamSessionId } from '../../../domains/workflow/app/chatbotAugmentedStreamPrompt';
import {
  buildPublishedChatbotPlaygroundAugmentedPrompt,
  resolvePublishedChatbotForPlayground,
} from '../../../domains/workflow/app/publishedChatbotPlaygroundPrompt';

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

const PROMPT_MAX_HEIGHT = 300;

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

  const navigate = useNavigate();
  const [, setIsGeneratingToken] = useState(false);
  const [, setTokenMessage] = useState('');
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [publishedChatbotApps, setPublishedChatbotApps] = useState<WorkflowAppRecord[]>(() =>
    listPublishedChatbotWorkflowApps(),
  );
  const [isWorkflowBlankCreateDialogOpen, setIsWorkflowBlankCreateDialogOpen] = useState(false);
  const activeRequestIdRef = useRef(0);
  const interruptedRequestIdsRef = useRef<Set<number>>(new Set());
  const activeControllerRef = useRef<AbortController | null>(null);
  const takeoutQuickReplyTimerRef = useRef<number | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const pendingImageUploadRef = useRef<Promise<string | null> | null>(null);

  const playgroundChatStreamSessionId = useMemo(
    () => getPlaygroundWorkflowChatStreamSessionId(sessionId, publishedChatbotWorkflowAppId),
    [sessionId, publishedChatbotWorkflowAppId],
  );

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

  useEffect(() => {
    setHistorySwitchConfirmTarget(null);
  }, [publishedChatbotWorkflowAppId]);

  useEffect(() => {
    if (!pendingImage) {
      pendingImageUploadRef.current = null;
    }
  }, [pendingImage]);

  const updateMessageListScrollPin = useCallback(() => {
    const element = messageListRef.current;
    if (!element) {
      return;
    }

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    stickToBottomRef.current = distanceFromBottom <= MESSAGE_LIST_STICK_THRESHOLD_PX;
    setShowScrollToBottom(distanceFromBottom > MESSAGE_LIST_STICK_THRESHOLD_PX);
  }, []);

  const scrollToBottom = useCallback(() => {
    const element = messageListRef.current;
    if (!element) {
      return;
    }

    stickToBottomRef.current = true;
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    setShowScrollToBottom(false);
  }, []);

  const adjustPromptTextareaHeight = useCallback(() => {
    const textarea = promptTextareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    const nextHeight = Math.min(textarea.scrollHeight, PROMPT_MAX_HEIGHT);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > PROMPT_MAX_HEIGHT ? 'auto' : 'hidden';
  }, []);

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

  const { metricsRefreshTimerRef, refreshMemoryMetrics, scheduleMemoryMetricsRefresh } = usePlaygroundMemoryMetrics({
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

  const refreshPublishedChatbotApps = useCallback(() => {
    setPublishedChatbotApps(listPublishedChatbotWorkflowApps());
  }, []);

  useEffect(() => {
    refreshPublishedChatbotApps();
  }, [refreshPublishedChatbotApps]);

  useEffect(() => {
    const onFocus = () => {
      refreshPublishedChatbotApps();
    };
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === WORKFLOW_APPS_STORAGE_KEY ||
        event.key?.startsWith(WORKFLOW_DRAFT_PREVIEW_STORAGE_PREFIX)
      ) {
        refreshPublishedChatbotApps();
      }
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    const onWorkflowAppsChanged = () => {
      refreshPublishedChatbotApps();
    };
    window.addEventListener('kronos:workflow-apps-changed', onWorkflowAppsChanged);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('kronos:workflow-apps-changed', onWorkflowAppsChanged);
    };
  }, [refreshPublishedChatbotApps]);

  useEffect(() => {
    if (!publishedChatbotWorkflowAppId) {
      return;
    }
    if (!publishedChatbotApps.some((row) => row.id === publishedChatbotWorkflowAppId)) {
      setPublishedChatbotWorkflowAppId(null);
    }
  }, [publishedChatbotApps, publishedChatbotWorkflowAppId, setPublishedChatbotWorkflowAppId]);

  const publishedChatbotRagValueSelector = useMemo((): ValueSelector => {
    if (!publishedChatbotWorkflowAppId) {
      return ['playground', 'none'];
    }
    return ['playground', 'app', publishedChatbotWorkflowAppId];
  }, [publishedChatbotWorkflowAppId]);

  const publishedChatbotRagVariableOptions = useMemo((): VariableOption[] => {
    return [
      {
        label: '.＋创建知识库',
        triggerLabel: createElement('span', { className: 'text-blue-600' }, '＋创建知识库'),
        valueSelector: ['playground', 'workflow-create'],
        valueType: 'RAG',
        source: 'node',
      },
      ...publishedChatbotApps.map(
        (app): VariableOption => ({
          label: `.${app.name}`,
          triggerLabel: app.name,
          valueSelector: ['playground', 'app', app.id],
          valueType: 'RAG',
          source: 'node',
        }),
      ),
    ];
  }, [publishedChatbotApps]);

  const handlePublishedChatbotRagVariableChange = useCallback(
    (value: ValueSelector) => {
      if (value[0] !== 'playground') {
        return;
      }
      const segment = value[1];
      if (segment === 'workflow-create') {
        setIsWorkflowBlankCreateDialogOpen(true);
        return;
      }
      if (segment === 'none') {
        setPublishedChatbotWorkflowAppId(null);
        return;
      }
      if (segment === 'app' && typeof value[2] === 'string' && value[2].length > 0) {
        setPublishedChatbotWorkflowAppId(value[2]);
      }
    },
    [setPublishedChatbotWorkflowAppId],
  );

  const closeWorkflowBlankCreateDialog = useCallback(() => {
    setIsWorkflowBlankCreateDialogOpen(false);
  }, []);

  const handleWorkflowBlankAppCreated = useCallback(
    (app: WorkflowAppRecord) => {
      setIsWorkflowBlankCreateDialogOpen(false);
      navigate(`/workflow/config?appId=${encodeURIComponent(app.id)}`);
    },
    [navigate],
  );

  const clearPublishedChatbotRagSelection = useCallback(() => {
    if (activeControllerRef.current) {
      interruptedRequestIdsRef.current.add(activeRequestIdRef.current);
      flushRemainingAssistantBuffer();
      abortStreamingAssistantMessage();
      setMessages((prev) => markLastAssistantMessageIncomplete(prev));
      activeControllerRef.current.abort();
      activeControllerRef.current = null;
    }

    setIsStreaming(false);
    setIsOrchestrating(false);
    resetAssistantStreamingState();
    clearTimelineEvents();
    setHistorySwitchConfirmTarget(null);
    setPublishedChatbotWorkflowAppId(null);

    if (authToken) {
      void hydrateSessionMessages(sessionId);
      void refreshMemoryMetrics(sessionId);
    }
  }, [
    abortStreamingAssistantMessage,
    authToken,
    clearTimelineEvents,
    flushRemainingAssistantBuffer,
    hydrateSessionMessages,
    refreshMemoryMetrics,
    resetAssistantStreamingState,
    sessionId,
    setIsOrchestrating,
    setIsStreaming,
    setMessages,
    setPublishedChatbotWorkflowAppId,
  ]);

  useEffect(() => {
    if (!authToken) {
      void generateDevToken();
    }
  }, [authToken, generateDevToken]);

  useEffect(() => {
    const element = messageListRef.current;
    if (!element || !stickToBottomRef.current) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [messages]);

  useEffect(() => {
    adjustPromptTextareaHeight();
  }, [adjustPromptTextareaHeight, prompt]);

  useEffect(() => {
    const element = messageListRef.current;
    if (!element) {
      return undefined;
    }

    updateMessageListScrollPin();
    element.addEventListener('scroll', updateMessageListScrollPin, { passive: true });
    return () => element.removeEventListener('scroll', updateMessageListScrollPin);
  }, [updateMessageListScrollPin]);

  useEffect(() => {
    const flushTimerId = streamFlushTimerRef.current;

    return () => {
      activeControllerRef.current?.abort();
      if (takeoutQuickReplyTimerRef.current !== null) {
        window.clearTimeout(takeoutQuickReplyTimerRef.current);
      }
      if (metricsRefreshTimerRef.current !== null) {
        window.clearTimeout(metricsRefreshTimerRef.current);
      }
      if (flushTimerId !== null) {
        window.clearTimeout(flushTimerId);
      }
    };
  }, [streamFlushTimerRef]);

  const renderPlainMessageContent = useCallback((message: LocalChatMessage) => {
    const suffix = message.isIncomplete ? '...' : '';
    const content = message.content || '';
    const cursor = message.role === 'assistant' && message.isStreamingText
      ? createElement('span', { className: 'ml-0.5 inline-block animate-pulse text-cyan-500' }, '|')
      : null;

    if (!content) {
      return '...';
    }

    if (message.role !== 'assistant' || !content.includes(MOCK_ADDRESS)) {
      return createElement(Fragment, null, content, suffix, cursor);
    }

    const [prefix, ...rest] = content.split(MOCK_ADDRESS);
    return createElement(
      Fragment,
      null,
      prefix,
      createElement('span', { className: 'text-blue-500' }, MOCK_ADDRESS),
      rest.join(MOCK_ADDRESS),
      suffix,
      cursor,
    );
  }, []);

  const sendPrompt = useCallback(async (overridePrompt?: string) => {
    const userPrompt = (overridePrompt ?? prompt).trim();

    if (!pendingImage && !pendingFile && !userPrompt) {
      return;
    }

    if (!overridePrompt && !canSend) {
      return;
    }

    stickToBottomRef.current = true;

    const resolvedAuthToken = authToken.trim() || await ensureKnowledgeDatasetAuthToken();

    if (pendingImage) {
      if (isStreaming || isOrchestrating || isAnalyzingImage) {
        return;
      }

      if (!resolvedAuthToken) {
        startAssistantTypewriter('识别图片前需要先准备 JWT。');
        return;
      }

      const imagePrompt = userPrompt || IMAGE_DEFAULT_PROMPT;
      const imageSnapshot = pendingImage;

      const imagePayload = await resolveImageUrlForBackend(
        imageSnapshot,
        pendingImageUploadRef.current,
      );
      pendingImageUploadRef.current = null;

      if (publishedChatbotWorkflowAppId) {
        const published = resolvePublishedChatbotForPlayground(publishedChatbotWorkflowAppId);
        if (published.kind === 'active' && published.orch.visionEnabled) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'user',
              content: '',
              imagePreviewUrl: imageSnapshot.dataUrl,
              imageName: imageSnapshot.fileName,
              isIncomplete: false,
            },
            { role: 'user', content: imagePrompt, isIncomplete: false },
            {
              role: 'assistant',
              content: '',
              isIncomplete: false,
              assistantInvocation: createAssistantInvocation({ modalities: ['image'] }),
            },
          ]);
          setLatestUserQuestion(imagePrompt);
          setPrompt('');
          setPendingImage(null);

          const previousRequestId = activeRequestIdRef.current;
          if (activeControllerRef.current) {
            interruptedRequestIdsRef.current.add(previousRequestId);
            flushRemainingAssistantBuffer();
            abortStreamingAssistantMessage();
            setMessages((prev) => markLastAssistantMessageIncomplete(prev));
            activeControllerRef.current.abort();
          }

          const requestId = previousRequestId + 1;
          activeRequestIdRef.current = requestId;
          const controller = new AbortController();
          activeControllerRef.current = controller;

          clearTimelineEvents();
          startStreamingAssistantMessage(createAssistantInvocation({ modalities: ['image'] }));

          let streamCompleted = false;
          try {
            const streamPrompt = await buildPublishedChatbotPlaygroundAugmentedPrompt({
              authToken: resolvedAuthToken,
              userQuery: imagePrompt,
              workflowAppId: publishedChatbotWorkflowAppId,
            });
            const maxV = Math.min(10, Math.max(1, Math.round(published.orch.visionMaxImages ?? 3)));
            const imageDataUrls = [imagePayload].slice(0, maxV);
            streamCompleted = await executePlaygroundChatStream({
              requestId,
              controller,
              streamPrompt,
              sessionUserContent: imagePrompt,
              streamSessionId: playgroundChatStreamSessionId,
              imageDataUrls,
              authToken: resolvedAuthToken,
            });
          } catch (error) {
            const isInterruptedRequest = interruptedRequestIdsRef.current.has(requestId) || controller.signal.aborted;

            if (requestId === activeRequestIdRef.current) {
              abortStreamingAssistantMessage();
              if (!streamCompleted) {
                setMessages((prev) => markLastAssistantMessageIncomplete(prev));
              }
              setIsStreaming(false);
              activeControllerRef.current = null;
            }

            interruptedRequestIdsRef.current.delete(requestId);

            if (isInterruptedRequest) {
              return;
            }

            const message = error instanceof Error ? error.message : '带图对话失败，请稍后重试';
            startAssistantTypewriter(message, {
              replaceLastAssistant: true,
              onComplete: () => {
                scheduleMemoryMetricsRefresh();
              },
            });
            return;
          }

          void scheduleMemoryMetricsRefresh();
          return;
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: '',
          imagePreviewUrl: imageSnapshot.dataUrl,
          imageName: imageSnapshot.fileName,
          isIncomplete: false,
        },
        { role: 'user', content: imagePrompt, isIncomplete: false },
        {
          role: 'assistant',
          content: '',
          isIncomplete: false,
          assistantInvocation: createAssistantInvocation({ modalities: ['image'] }),
        },
      ]);
      setLatestUserQuestion(imagePrompt);
      setPrompt('');
      setPendingImage(null);
      setIsAnalyzingImage(true);

      const imageInvocation = createAssistantInvocation({ modalities: ['image'] });

      try {
        const response = await requestImageRecognition({
          authToken: resolvedAuthToken,
          imageDataUrl: imagePayload,
          prompt: imagePrompt,
          sessionId,
        });

        startAssistantTypewriter(response.reply, {
          replaceLastAssistant: true,
          assistantInvocation: imageInvocation,
          onComplete: () => {
            scheduleMemoryMetricsRefresh();
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '图片识别失败，请稍后重试';
        startAssistantTypewriter(message, {
          replaceLastAssistant: true,
          assistantInvocation: imageInvocation,
          onComplete: () => {
            scheduleMemoryMetricsRefresh();
          },
        });
      } finally {
        setIsAnalyzingImage(false);
      }

      return;
    }

    if (pendingFile) {
      if (isStreaming || isOrchestrating || isAnalyzingImage) {
        return;
      }

      if (!resolvedAuthToken) {
        startAssistantTypewriter('解读文件前需要先准备 JWT。');
        return;
      }

      const filePrompt = userPrompt || FILE_DEFAULT_PROMPT;

      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: '',
          fileName: pendingFile.fileName,
          fileExtension: pendingFile.extension,
          fileSize: pendingFile.size,
          isIncomplete: false,
        },
        { role: 'user', content: filePrompt, isIncomplete: false },
        {
          role: 'assistant',
          content: '',
          isIncomplete: false,
          assistantInvocation: createAssistantInvocation({ modalities: ['file'] }),
        },
      ]);
      setLatestUserQuestion(filePrompt);
      setPrompt('');
      setPendingFile(null);
      setIsAnalyzingImage(true);

      const fileInvocation = createAssistantInvocation({ modalities: ['file'] });

      try {
        const response = await requestFileAnalysis({
          authToken: resolvedAuthToken,
          fileDataUrl: pendingFile.dataUrl,
          fileName: pendingFile.fileName,
          mimeType: pendingFile.mimeType,
          prompt: filePrompt,
          sessionId,
        });

        startAssistantTypewriter(response.reply, {
          replaceLastAssistant: true,
          assistantInvocation: fileInvocation,
          onComplete: () => {
            scheduleMemoryMetricsRefresh();
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '文件解读失败，请稍后重试';
        startAssistantTypewriter(message, {
          replaceLastAssistant: true,
          assistantInvocation: fileInvocation,
          onComplete: () => {
            scheduleMemoryMetricsRefresh();
          },
        });
      } finally {
        setIsAnalyzingImage(false);
      }

      return;
    }

    setMessages((prev) => [...prev, { role: 'user', content: userPrompt, isIncomplete: false }]);
    setPrompt('');
    setLatestUserQuestion(userPrompt);

    const tryHandleTakeout = async (): Promise<boolean> => {
      if (!resolvedAuthToken) {
        if (isAwaitingTakeoutFollowup) {
          startAssistantTypewriter('请先完成 JWT 鉴权后再继续点餐，我会根据你的具体需求进入外卖流程。');
          return true;
        }

        return isTakeoutIntentPrompt(userPrompt);
      }

      try {
        setIsOrchestrating(true);
        const orchestrated = await requestTakeoutOrchestration({
          authToken: resolvedAuthToken,
          prompt: userPrompt,
          history: messages.slice(-6).map((message) => message.content),
          sessionId,
        });

        if (orchestrated.action === 'delegate_chat_stream') {
          return false;
        }

        if (orchestrated.action === 'chat' || orchestrated.action === 'ask_slot') {
          startAssistantTypewriter(orchestrated.assistantReply, {
            onComplete: () => {
              scheduleMemoryMetricsRefresh();
            },
          });
          return true;
        }

        if (orchestrated.action === 'tool_call' && orchestrated.toolCall?.name === 'takeout') {
          if (isAwaitingTakeoutFollowup) {
            setIsAwaitingTakeoutFollowup(false);
          }

          await startTakeoutConversation(userPrompt);
          scheduleMemoryMetricsRefresh();
          return true;
        }

        return false;
      } catch {
        if (isTakeoutIntentPrompt(userPrompt)) {
          if (isAwaitingTakeoutFollowup) {
            setIsAwaitingTakeoutFollowup(false);
          }

          await startTakeoutConversation(userPrompt);
          scheduleMemoryMetricsRefresh();
          return true;
        }

        return false;
      } finally {
        setIsOrchestrating(false);
      }
    };

    // 先走外卖编排（LLM 路由器）；非外卖时 orchestrate 返回 delegate_chat_stream，再进入 RAG / 默认 Agent。
    if (await tryHandleTakeout()) {
      return;
    }

    if (
      !publishedChatbotWorkflowAppId
      && !resolvedAuthToken
      && !isAwaitingTakeoutFollowup
      && isTakeoutIntentPrompt(userPrompt)
    ) {
      await startTakeoutConversation();
      return;
    }

    if (!resolvedAuthToken) {
      startAssistantTypewriter('发送前需要先准备 JWT。');
      return;
    }

    const previousRequestId = activeRequestIdRef.current;
    if (activeControllerRef.current) {
      interruptedRequestIdsRef.current.add(previousRequestId);
      flushRemainingAssistantBuffer();
      abortStreamingAssistantMessage();
      setMessages((prev) => markLastAssistantMessageIncomplete(prev));
      activeControllerRef.current.abort();
    }

    const requestId = previousRequestId + 1;
    activeRequestIdRef.current = requestId;
    const controller = new AbortController();
    activeControllerRef.current = controller;

    clearTimelineEvents();
    resetAssistantStreamingState();
    startStreamingAssistantMessage();

    let streamPrompt = userPrompt;
    if (publishedChatbotWorkflowAppId) {
      try {
        streamPrompt = await buildPublishedChatbotPlaygroundAugmentedPrompt({
          authToken: resolvedAuthToken,
          userQuery: userPrompt,
          workflowAppId: publishedChatbotWorkflowAppId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'RAG 应用检索失败，请稍后重试';
        abortStreamingAssistantMessage();
        startAssistantTypewriter(message, { replaceLastAssistant: true });
        setIsStreaming(false);
        activeControllerRef.current = null;
        interruptedRequestIdsRef.current.delete(requestId);
        return;
      }
    }

    let streamCompleted = false;
    try {
      streamCompleted = await executePlaygroundChatStream({
        requestId,
        controller,
        streamPrompt,
        ...(publishedChatbotWorkflowAppId ? { sessionUserContent: userPrompt } : {}),
        streamSessionId: playgroundChatStreamSessionId,
        authToken: resolvedAuthToken,
      });
    } catch {
      const isInterruptedRequest = interruptedRequestIdsRef.current.has(requestId) || controller.signal.aborted;

      if (requestId === activeRequestIdRef.current) {
        abortStreamingAssistantMessage();
        if (!streamCompleted) {
          setMessages((prev) => markLastAssistantMessageIncomplete(prev));
        }
        setIsStreaming(false);
        activeControllerRef.current = null;
      }

      interruptedRequestIdsRef.current.delete(requestId);

      if (isInterruptedRequest) {
        return;
      }
    }
  }, [abortStreamingAssistantMessage, authToken, canSend, clearTimelineEvents, executePlaygroundChatStream, flushRemainingAssistantBuffer, isAnalyzingImage, isAwaitingTakeoutFollowup, isOrchestrating, isStreaming, messages, pendingFile, pendingImage, playgroundChatStreamSessionId, prompt, publishedChatbotWorkflowAppId, resetAssistantStreamingState, scheduleMemoryMetricsRefresh, sessionId, setIsAnalyzingImage, setIsAwaitingTakeoutFollowup, setIsOrchestrating, setIsStreaming, setLatestUserQuestion, setMessages, setPendingFile, setPendingImage, setPrompt, startAssistantTypewriter, startStreamingAssistantMessage, startTakeoutConversation]);

  const handleExplainImageClick = useCallback(() => {
    if (!pendingImage || prompt.trim().length > 0) {
      return;
    }

    void sendPrompt(IMAGE_DEFAULT_PROMPT);
  }, [pendingImage, prompt, sendPrompt]);

  const handleExplainFileClick = useCallback(() => {
    if (!pendingFile || prompt.trim().length > 0) {
      return;
    }

    void sendPrompt(FILE_DEFAULT_PROMPT);
  }, [pendingFile, prompt, sendPrompt]);

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
  }, [isAnalyzingImage, isOrchestrating, isStreaming, sendPrompt]);

  const applyHistorySessionSwitch = useCallback(
    (target: RecentDialogueItem) => {
      setIsHistoryOpen(false);
      activeControllerRef.current?.abort();
      activeControllerRef.current = null;
      resetAssistantStreamingState();
      setIsStreaming(false);
      setIsOrchestrating(false);
      setIsAwaitingTakeoutFollowup(false);
      clearTimelineEvents();
      switchPlaygroundHistorySession({
        basePlaygroundSessionId: target.basePlaygroundSessionId,
        publishedChatbotWorkflowAppId: target.publishedChatbotWorkflowAppId,
      });
    },
    [
      clearTimelineEvents,
      resetAssistantStreamingState,
      setIsAwaitingTakeoutFollowup,
      setIsOrchestrating,
      setIsStreaming,
      switchPlaygroundHistorySession,
    ],
  );

  const handleStartNewConversation = useCallback(() => {
    setIsHistoryOpen(false);
    setHistorySwitchConfirmTarget(null);

    if (messages.length === 0) {
      if (!hasRestorableDraft) {
        return;
      }

      activeControllerRef.current?.abort();
      activeControllerRef.current = null;
      resetAssistantStreamingState();
      setIsStreaming(false);
      setIsOrchestrating(false);
      setIsAwaitingTakeoutFollowup(false);
      clearTimelineEvents();
      resetChatPanelState();
      return;
    }

    activeControllerRef.current?.abort();
    activeControllerRef.current = null;
    resetAssistantStreamingState();
    setIsStreaming(false);
    setIsOrchestrating(false);
    setIsAwaitingTakeoutFollowup(false);
    clearTimelineEvents();
    setSessionId(createPlaygroundSessionId());
    void refreshRecentSessions();
  }, [
    clearTimelineEvents,
    hasRestorableDraft,
    messages.length,
    refreshRecentSessions,
    resetAssistantStreamingState,
    resetChatPanelState,
    setIsAwaitingTakeoutFollowup,
    setIsOrchestrating,
    setIsStreaming,
    setSessionId,
  ]);

  const handleHistoryItemClick = useCallback(
    (target: RecentDialogueItem) => {
      const sameRouting =
        target.basePlaygroundSessionId === sessionId &&
        (target.publishedChatbotWorkflowAppId ?? null) === (publishedChatbotWorkflowAppId ?? null);
      if (sameRouting) {
        setIsHistoryOpen(false);
        return;
      }

      if (hasRestorableDraft) {
        setHistorySwitchConfirmTarget(target);
        return;
      }

      applyHistorySessionSwitch(target);
    },
    [applyHistorySessionSwitch, hasRestorableDraft, publishedChatbotWorkflowAppId, sessionId],
  );

  const cancelHistorySessionSwitch = useCallback(() => {
    setIsHistoryOpen(true);
    setHistorySwitchConfirmTarget(null);
  }, []);

  const confirmHistorySessionSwitch = useCallback(() => {
    if (!historySwitchConfirmTarget) {
      return;
    }

    applyHistorySessionSwitch(historySwitchConfirmTarget);
    setHistorySwitchConfirmTarget(null);
  }, [applyHistorySessionSwitch, historySwitchConfirmTarget]);

  const handleQuickActionClick = useCallback((action: PromptQuickAction['key']) => {
    if (action === 'takeout') {
      if (isStreaming || isOrchestrating || isAnalyzingImage || takeoutQuickReplyTimerRef.current !== null) {
        return;
      }

      const takeoutPrompt = getTakeoutQuickActionPrompt(prompt);
      const takeoutInvocation = createAssistantInvocation({ modalities: ['takeout'] });
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: takeoutPrompt, isIncomplete: false },
        {
          role: 'assistant',
          content: '',
          isIncomplete: false,
          assistantInvocation: takeoutInvocation,
        },
      ]);
      setPrompt('');
      setLatestUserQuestion(takeoutPrompt);

      takeoutQuickReplyTimerRef.current = window.setTimeout(() => {
        startAssistantTypewriter(TAKEOUT_QUICK_ACTION_REPLY, {
          replaceLastAssistant: true,
          assistantInvocation: takeoutInvocation,
          onComplete: () => {
            setIsAwaitingTakeoutFollowup(true);
            scheduleMemoryMetricsRefresh();
          },
        });

        takeoutQuickReplyTimerRef.current = null;
      }, TAKEOUT_QUICK_ACTION_REPLY_DELAY_MS);
      return;
    }

    if (action === 'file') {
      if (isStreaming || isOrchestrating || isAnalyzingImage) {
        return;
      }

      fileInputRef.current?.click();
      return;
    }

    if (action === 'image') {
      if (isStreaming || isOrchestrating || isAnalyzingImage) {
        return;
      }

      imageInputRef.current?.click();
      return;
    }

    if (action === 'translate') {
      setPrompt((prev) => `${prev}${prev ? ' ' : ''}/translate `);
    }
  }, [isAnalyzingImage, isOrchestrating, isStreaming, prompt, scheduleMemoryMetricsRefresh, setIsAwaitingTakeoutFollowup, setLatestUserQuestion, setMessages, setPrompt, startAssistantTypewriter]);

  const handleImageFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile) {
      return;
    }

    try {
      const preparedImage = await prepareImageForAnalyze(selectedFile);
      setPendingFile(null);
      setPendingImage({ ...preparedImage, imgbbUploadState: 'pending' });

      if (!authToken) {
        setPendingImage({ ...preparedImage, imgbbUploadState: 'failed' });
        requestAnimationFrame(() => {
          promptTextareaRef.current?.focus();
        });
        return;
      }

      const uploadPromise = uploadImageToImgbb(preparedImage, authToken)
        .then((remoteUrl) => {
          setPendingImage((prev) => {
            if (!prev || prev.dataUrl !== preparedImage.dataUrl) {
              return prev;
            }
            return { ...prev, remoteUrl, imgbbUploadState: 'ready' };
          });
          return remoteUrl;
        })
        .catch(() => {
          setPendingImage((prev) => {
            if (!prev || prev.dataUrl !== preparedImage.dataUrl) {
              return prev;
            }
            return { ...prev, imgbbUploadState: 'failed' };
          });
          return null;
        });

      pendingImageUploadRef.current = uploadPromise;

      requestAnimationFrame(() => {
        promptTextareaRef.current?.focus();
      });
    } catch (error) {
      pendingImageUploadRef.current = null;
      const message = error instanceof Error ? error.message : '图片识别失败，请稍后重试';
      startAssistantTypewriter(message);
    }
  }, [authToken, setPendingFile, setPendingImage, startAssistantTypewriter]);

  const handleDocumentFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile) {
      return;
    }

    try {
      const preparedFile = await prepareFileForAnalyze(selectedFile);
      setPendingImage(null);
      setPendingFile(preparedFile);
      requestAnimationFrame(() => {
        promptTextareaRef.current?.focus();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '文件读取失败，请稍后重试';
      startAssistantTypewriter(message);
    }
  }, [setPendingFile, setPendingImage, startAssistantTypewriter]);

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