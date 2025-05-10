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
import { fetchEventSource } from '@microsoft/fetch-event-source';

import {
  apiUrl,
  requestDevToken,
  requestFileAnalysis,
  requestHotTopics,
  requestImageRecognition,
  requestRecentSessions,
  requestSessionSnapshot,
  requestTakeoutOrchestration,
} from '../../../lib/api';
import {
  getCachedLocalStorage,
  getNextDayStartTimestamp,
  setCachedLocalStorage,
} from '../../../lib/localStorageCache';
import { usePlaygroundStore } from '../../../store/playgroundStore';
import type { StreamChunk, TimelineEvent } from '../../../types/chat';
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
  type ImageSelectionResult,
} from '../../agent-tools/image';
import {
  DEFAULT_HOT_TOPICS,
  FILE_DEFAULT_PROMPT,
  HOT_TOPICS_CACHE_KEY,
  IMAGE_DEFAULT_PROMPT,
  MAX_CONTEXT_TOKENS,
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
import {
  buildConversationText,
  countTextTokens,
  hydrateRenderableMessages,
  markLastAssistantMessageIncomplete,
} from '../utils/chatStreamHelpers';
import { getLatestUserQuestion } from '../utils/chatStreamHelpers';
import { useAssistantTypewriter } from './useAssistantTypewriter';

export type UseChatStreamControllerResult = {
  canSend: boolean;
  currentTimelineEvent: TimelineEvent | undefined;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  formatTimestamp: (timestamp: number) => string;
  handleDocumentFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleExplainFileClick: () => void;
  handleExplainImageClick: () => void;
  handleHistoryItemClick: (targetSessionId: string) => void;
  handleHotTopicClick: (topic: string) => void;
  handleImageFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handlePromptKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleQuickActionClick: (action: PromptQuickAction['key']) => void;
  handleTakeoutCancel: (flowId: number) => void;
  confirmHistorySessionSwitch: () => void;
  cancelHistorySessionSwitch: () => void;
  historyPanelRef: MutableRefObject<HTMLDivElement | null>;
  historySwitchConfirmTargetId: string | null;
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
  takeoutFlowState: TakeoutFlowState;
  takeoutFoodsScrollerRef: MutableRefObject<HTMLDivElement | null>;
  takeoutLoadingLabel: string;
  toggleHistoryPanel: () => void;
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
    setSessionId,
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
    setTakeoutFlowState,
  } = usePlaygroundStore();

  const [, setIsGeneratingToken] = useState(false);
  const [, setTokenMessage] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historySwitchConfirmTargetId, setHistorySwitchConfirmTargetId] = useState<string | null>(null);
  const [recentDialogues, setRecentDialogues] = useState<RecentDialogueItem[]>([]);
  const [hotTopics, setHotTopics] = useState<string[]>(() => getCachedLocalStorage<string[]>(HOT_TOPICS_CACHE_KEY) || [...DEFAULT_HOT_TOPICS]);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const activeRequestIdRef = useRef(0);
  const interruptedRequestIdsRef = useRef<Set<number>>(new Set());
  const activeControllerRef = useRef<AbortController | null>(null);
  const takeoutQuickReplyTimerRef = useRef<number | null>(null);
  const metricsRefreshTimerRef = useRef<number | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const historyPanelRef = useRef<HTMLDivElement | null>(null);

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

  const scrollToBottom = useCallback(() => {
    const element = messageListRef.current;
    if (element) {
      element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    }
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

  const refreshMemoryMetrics = useCallback(async () => {
    if (!authToken) {
      return;
    }

    try {
      const snapshot = await requestSessionSnapshot({ sessionId, authToken });
      const [conversationTokens, summaryTokens] = await Promise.all([
        countTextTokens(buildConversationText(snapshot.messages)),
        countTextTokens(snapshot.memorySummary),
      ]);
      const budgetTokens = Math.max(0, MAX_CONTEXT_TOKENS - conversationTokens - summaryTokens);

      setMemoryMetrics({
        ...snapshot.memoryMetrics,
        conversationTokensEstimate: conversationTokens,
        summaryTokensEstimate: summaryTokens,
        budgetTokensEstimate: budgetTokens,
      });
    } catch {
      // 会话指标刷新失败时保留当前展示，避免影响主流程。
    }
  }, [authToken, sessionId, setMemoryMetrics]);

  const scheduleMemoryMetricsRefresh = useCallback((delayMs = 180) => {
    if (!authToken) {
      return;
    }

    if (metricsRefreshTimerRef.current !== null) {
      window.clearTimeout(metricsRefreshTimerRef.current);
    }

    metricsRefreshTimerRef.current = window.setTimeout(() => {
      metricsRefreshTimerRef.current = null;
      void refreshMemoryMetrics();
    }, delayMs);
  }, [authToken, refreshMemoryMetrics]);

  const refreshRecentSessions = useCallback(async () => {
    if (!authToken) {
      return;
    }

    setIsHistoryLoading(true);
    try {
      const response = await requestRecentSessions({ authToken, limit: 10 });
      setRecentDialogues(response.items);
    } catch {
      setRecentDialogues([]);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [authToken]);

  const hydrateSessionMessages = useCallback(async () => {
    if (!authToken) {
      return;
    }

    try {
      const snapshot = await requestSessionSnapshot({ sessionId, authToken });
      const [conversationTokens, summaryTokens] = await Promise.all([
        countTextTokens(buildConversationText(snapshot.messages)),
        countTextTokens(snapshot.memorySummary),
      ]);
      const budgetTokens = Math.max(0, MAX_CONTEXT_TOKENS - conversationTokens - summaryTokens);

      setMessages(hydrateRenderableMessages(snapshot.messages));
      setLatestUserQuestion(getLatestUserQuestion(snapshot.messages));
      setMemoryMetrics({
        ...snapshot.memoryMetrics,
        conversationTokensEstimate: conversationTokens,
        summaryTokensEstimate: summaryTokens,
        budgetTokensEstimate: budgetTokens,
      });
    } catch {
      // 历史会话回显失败时保留当前界面状态。
    }
  }, [authToken, sessionId, setLatestUserQuestion, setMemoryMetrics, setMessages]);

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

  useEffect(() => {
    if (!authToken) {
      void generateDevToken();
    }
  }, [authToken, generateDevToken]);

  useEffect(() => {
    const cachedTopics = getCachedLocalStorage<string[]>(HOT_TOPICS_CACHE_KEY);
    if (cachedTopics && cachedTopics.length > 0) {
      setHotTopics(cachedTopics);
      return undefined;
    }

    if (!authToken) {
      return undefined;
    }

    let isCancelled = false;

    const hydrateHotTopics = async () => {
      try {
        const result = await requestHotTopics({ authToken });
        if (isCancelled || result.topics.length === 0) {
          return;
        }

        setHotTopics(result.topics);
        setCachedLocalStorage(HOT_TOPICS_CACHE_KEY, result.topics, getNextDayStartTimestamp());
      } catch {
        // 热门问题获取失败时继续使用本地兜底列表。
      }
    };

    void hydrateHotTopics();

    return () => {
      isCancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (hasRestorableDraft) {
      return;
    }

    void hydrateSessionMessages();
  }, [hasRestorableDraft, hydrateSessionMessages]);

  useEffect(() => {
    void refreshMemoryMetrics();
  }, [latestTimelineEventId, refreshMemoryMetrics]);

  useEffect(() => {
    if (!isStreaming) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void refreshMemoryMetrics();
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isStreaming, refreshMemoryMetrics]);

  useEffect(() => {
    if (!authToken || isStreaming || isOrchestrating || isAnalyzingImage) {
      return;
    }

    scheduleMemoryMetricsRefresh();
  }, [authToken, isAnalyzingImage, isOrchestrating, isStreaming, latestMessageSignature, scheduleMemoryMetricsRefresh]);

  useEffect(() => {
    const element = messageListRef.current;
    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [messages]);

  useEffect(() => {
    adjustPromptTextareaHeight();
  }, [adjustPromptTextareaHeight, prompt]);

  useEffect(() => {
    if (!isHistoryOpen || historySwitchConfirmTargetId) {
      return undefined;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!historyPanelRef.current?.contains(target)) {
        setIsHistoryOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, [historySwitchConfirmTargetId, isHistoryOpen]);

  useEffect(() => {
    const element = messageListRef.current;
    if (!element) {
      return undefined;
    }

    const handleScroll = () => {
      const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
      setShowScrollToBottom(distanceFromBottom > 80);
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => element.removeEventListener('scroll', handleScroll);
  }, []);

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

    if (pendingImage) {
      if (isStreaming || isOrchestrating || isAnalyzingImage) {
        return;
      }

      if (!authToken) {
        startAssistantTypewriter('识别图片前需要先准备 JWT。');
        return;
      }

      const imagePrompt = userPrompt || IMAGE_DEFAULT_PROMPT;

      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: '',
          imagePreviewUrl: pendingImage.dataUrl,
          imageName: pendingImage.fileName,
          isIncomplete: false,
        },
        { role: 'user', content: imagePrompt, isIncomplete: false },
        { role: 'assistant', content: '', isIncomplete: false },
      ]);
      setLatestUserQuestion(imagePrompt);
      setPrompt('');
      setPendingImage(null);
      setIsAnalyzingImage(true);

      try {
        const response = await requestImageRecognition({
          authToken,
          imageDataUrl: pendingImage.dataUrl,
          prompt: imagePrompt,
          sessionId,
        });

        startAssistantTypewriter(response.reply, {
          replaceLastAssistant: true,
          onComplete: () => {
            scheduleMemoryMetricsRefresh();
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '图片识别失败，请稍后重试';
        startAssistantTypewriter(message, {
          replaceLastAssistant: true,
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

      if (!authToken) {
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
        { role: 'assistant', content: '', isIncomplete: false },
      ]);
      setLatestUserQuestion(filePrompt);
      setPrompt('');
      setPendingFile(null);
      setIsAnalyzingImage(true);

      try {
        const response = await requestFileAnalysis({
          authToken,
          fileDataUrl: pendingFile.dataUrl,
          fileName: pendingFile.fileName,
          mimeType: pendingFile.mimeType,
          prompt: filePrompt,
          sessionId,
        });

        startAssistantTypewriter(response.reply, {
          replaceLastAssistant: true,
          onComplete: () => {
            scheduleMemoryMetricsRefresh();
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '文件解读失败，请稍后重试';
        startAssistantTypewriter(message, {
          replaceLastAssistant: true,
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
      if (!authToken) {
        if (isAwaitingTakeoutFollowup) {
          startAssistantTypewriter('请先完成 JWT 鉴权后再继续点餐，我会根据你的具体需求进入外卖流程。');
          return true;
        }

        return isTakeoutIntentPrompt(userPrompt);
      }

      try {
        setIsOrchestrating(true);
        const orchestrated = await requestTakeoutOrchestration({
          authToken,
          prompt: userPrompt,
          history: messages.slice(-6).map((message) => message.content),
          sessionId,
        });

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
        return false;
      } finally {
        setIsOrchestrating(false);
      }
    };

    if (await tryHandleTakeout()) {
      return;
    }

    if (!authToken && !isAwaitingTakeoutFollowup && isTakeoutIntentPrompt(userPrompt)) {
      await startTakeoutConversation();
      return;
    }

    if (!authToken) {
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
    let lastSeenEventId = 0;
    let isRequestComplete = false;

    clearTimelineEvents();
    startStreamingAssistantMessage();

    try {
      await fetchEventSource(apiUrl('/api/chat-stream'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ prompt: userPrompt, sessionId }),
        signal: controller.signal,
        onmessage(event) {
          if (requestId !== activeRequestIdRef.current) {
            return;
          }

          const payload = JSON.parse(event.data) as StreamChunk;

          if (payload.eventId <= lastSeenEventId) {
            return;
          }
          lastSeenEventId = payload.eventId;

          if (payload.type === 'timeline') {
            appendTimelineEvent({
              eventId: payload.eventId,
              stage: payload.stage,
              status: payload.status,
              message: payload.message,
              toolName: payload.toolName,
              toolInput: payload.toolInput,
              toolOutput: payload.toolOutput,
              toolError: payload.toolError,
              timestamp: payload.timestamp,
            });

            if (payload.message.includes('LangChain 流式响应失败')) {
              console.warn(`[ChatStreamPanel] ${payload.message}`);
            }
          }

          if (payload.type === 'content') {
            appendStreamingContent(payload.content);
          }

          if (payload.type === 'complete') {
            isRequestComplete = true;
            if (requestId === activeRequestIdRef.current) {
              completeStreamingContent();
            }
          }
        },
        onerror(error) {
          if (requestId === activeRequestIdRef.current) {
            abortStreamingAssistantMessage();
          }
          throw error;
        },
        onclose() {
          if (!isRequestComplete && requestId === activeRequestIdRef.current) {
            abortStreamingAssistantMessage();
            setMessages((prev) => markLastAssistantMessageIncomplete(prev));
          }

          if (!isRequestComplete && requestId === activeRequestIdRef.current) {
            setIsStreaming(false);
            activeControllerRef.current = null;
          }

          interruptedRequestIdsRef.current.delete(requestId);
        },
      });
    } catch {
      const isInterruptedRequest = interruptedRequestIdsRef.current.has(requestId) || controller.signal.aborted;

      if (requestId === activeRequestIdRef.current) {
        abortStreamingAssistantMessage();
        if (!isRequestComplete) {
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
  }, [abortStreamingAssistantMessage, appendStreamingContent, appendTimelineEvent, authToken, canSend, clearTimelineEvents, completeStreamingContent, flushRemainingAssistantBuffer, isAnalyzingImage, isAwaitingTakeoutFollowup, isOrchestrating, isStreaming, messages, pendingFile, pendingImage, prompt, scheduleMemoryMetricsRefresh, sessionId, setIsAnalyzingImage, setIsAwaitingTakeoutFollowup, setIsOrchestrating, setIsStreaming, setLatestUserQuestion, setMessages, setPendingFile, setPendingImage, setPrompt, startAssistantTypewriter, startStreamingAssistantMessage, startTakeoutConversation]);

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

  const applyHistorySessionSwitch = useCallback((targetSessionId: string) => {
    setIsHistoryOpen(false);
    activeControllerRef.current?.abort();
    activeControllerRef.current = null;
    resetAssistantStreamingState();
    setIsStreaming(false);
    setIsOrchestrating(false);
    setIsAwaitingTakeoutFollowup(false);
    clearTimelineEvents();
    setSessionId(targetSessionId);
  }, [clearTimelineEvents, resetAssistantStreamingState, setIsAwaitingTakeoutFollowup, setIsOrchestrating, setIsStreaming, setSessionId]);

  const toggleHistoryPanel = useCallback(() => {
    const nextOpen = !isHistoryOpen;
    setIsHistoryOpen(nextOpen);

    if (nextOpen) {
      void refreshRecentSessions();
    }
  }, [isHistoryOpen, refreshRecentSessions]);

  const handleHistoryItemClick = useCallback((targetSessionId: string) => {
    if (targetSessionId === sessionId) {
      setIsHistoryOpen(false);
      return;
    }

    if (messages.length > 0) {
      setHistorySwitchConfirmTargetId(targetSessionId);
      return;
    }

    applyHistorySessionSwitch(targetSessionId);
  }, [applyHistorySessionSwitch, messages.length, sessionId]);

  const cancelHistorySessionSwitch = useCallback(() => {
    setIsHistoryOpen(true);
    setHistorySwitchConfirmTargetId(null);
  }, []);

  const confirmHistorySessionSwitch = useCallback(() => {
    if (!historySwitchConfirmTargetId) {
      return;
    }

    applyHistorySessionSwitch(historySwitchConfirmTargetId);
    setHistorySwitchConfirmTargetId(null);
  }, [applyHistorySessionSwitch, historySwitchConfirmTargetId]);

  const handleQuickActionClick = useCallback((action: PromptQuickAction['key']) => {
    if (action === 'takeout') {
      if (isStreaming || isOrchestrating || isAnalyzingImage || takeoutQuickReplyTimerRef.current !== null) {
        return;
      }

      const takeoutPrompt = getTakeoutQuickActionPrompt(prompt);
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: takeoutPrompt, isIncomplete: false },
        { role: 'assistant', content: '', isIncomplete: false },
      ]);
      setPrompt('');
      setLatestUserQuestion(takeoutPrompt);

      takeoutQuickReplyTimerRef.current = window.setTimeout(() => {
        startAssistantTypewriter(TAKEOUT_QUICK_ACTION_REPLY, {
          replaceLastAssistant: true,
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
      setPendingImage(preparedImage);
      requestAnimationFrame(() => {
        promptTextareaRef.current?.focus();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片识别失败，请稍后重试';
      startAssistantTypewriter(message);
    }
  }, [setPendingFile, setPendingImage, startAssistantTypewriter]);

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
    handleHotTopicClick,
    handleImageFileChange,
    handlePromptKeyDown,
    handleQuickActionClick,
    handleTakeoutCancel,
    historyPanelRef,
    historySwitchConfirmTargetId,
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
    takeoutFlowState,
    takeoutFoodsScrollerRef,
    takeoutLoadingLabel,
    toggleHistoryPanel,
  };
};