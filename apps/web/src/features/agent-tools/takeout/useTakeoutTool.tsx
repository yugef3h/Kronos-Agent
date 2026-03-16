import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { MOCK_ADDRESS, MOCK_DISCOUNT, type TakeoutCombo, type TakeoutFood } from './data/mockData';
import {
  buildTakeoutOrderPrompt,
  createInitialTakeoutFlowState,
} from './helpers';
import { callDoubaoAPI } from './services/doubaoMockApi';
import type {
  TakeoutAssistantMessageOptions,
  TakeoutChatMessage,
  TakeoutFlowState,
  TakeoutMessageType,
  TakeoutMessageUpdater,
  TakeoutModalState,
} from './types';

type UseTakeoutToolParams = {
  messages: TakeoutChatMessage[];
  setMessages: TakeoutMessageUpdater;
};

type UseTakeoutToolResult = {
  flowState: TakeoutFlowState;
  modalState: TakeoutModalState;
  isTakeoutAgreementChecked: boolean;
  setIsTakeoutAgreementChecked: (nextValue: boolean) => void;
  foodsScrollerRef: RefObject<HTMLDivElement>;
  paymentInputRef: RefObject<HTMLInputElement>;
  showTakeoutScrollHint: boolean;
  startTakeoutConversation: () => Promise<void>;
  openTakeoutAuthorizationModal: (flowId: number) => void;
  closeTakeoutAuthorizationModal: () => void;
  handleTakeoutAgreement: (flowId: number) => Promise<void>;
  handleTakeoutCancel: (flowId: number) => void;
  handleTakeoutSelectFood: (flowId: number, food: TakeoutFood) => void;
  handleTakeoutSelectSnack: (flowId: number, snackId: string) => void;
  closeTakeoutComboModal: () => void;
  handleTakeoutSelectCombo: (flowId: number, combo: TakeoutCombo) => void;
  handleTakeoutConfirmSelection: (flowId: number) => Promise<void>;
  openTakeoutPaymentModal: (flowId: number) => void;
  closeTakeoutPaymentModal: () => void;
  handleTakeoutPaymentPasswordChange: (flowId: number, rawValue: string) => void;
};

const createInitialModalState = (): TakeoutModalState => ({
  authFlowId: null,
  comboFlowId: null,
  paymentFlowId: null,
});

export const useTakeoutTool = ({
  messages,
  setMessages,
}: UseTakeoutToolParams): UseTakeoutToolResult => {
  const [flowState, setFlowState] = useState<TakeoutFlowState>(createInitialTakeoutFlowState());
  const [modalState, setModalState] = useState<TakeoutModalState>(createInitialModalState());
  const [isTakeoutAgreementChecked, setIsTakeoutAgreementChecked] = useState(true);
  const [showTakeoutScrollHint, setShowTakeoutScrollHint] = useState(false);
  const foodsScrollerRef = useRef<HTMLDivElement | null>(null);
  const paymentInputRef = useRef<HTMLInputElement | null>(null);

  const resetModalState = useCallback(() => {
    setModalState(createInitialModalState());
  }, []);

  const refreshTakeoutScrollHint = useCallback(() => {
    const scroller = foodsScrollerRef.current;
    if (!scroller) {
      setShowTakeoutScrollHint(false);
      return;
    }

    const hasHorizontalOverflow = scroller.scrollWidth - scroller.clientWidth > 10;
    const isAtStart = scroller.scrollLeft <= 8;
    setShowTakeoutScrollHint(hasHorizontalOverflow && isAtStart);
  }, []);

  useEffect(() => {
    const scroller = foodsScrollerRef.current;
    if (!scroller) {
      return;
    }

    const handleScroll = () => {
      refreshTakeoutScrollHint();
    };

    refreshTakeoutScrollHint();
    scroller.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', refreshTakeoutScrollHint);

    return () => {
      scroller.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', refreshTakeoutScrollHint);
    };
  }, [messages, refreshTakeoutScrollHint]);

  useEffect(() => {
    if (modalState.paymentFlowId !== flowState.flowId) {
      return;
    }

    paymentInputRef.current?.focus();
  }, [flowState.flowId, modalState.paymentFlowId]);

  const appendAssistantTextMessage = useCallback(
    (content: string, options?: TakeoutAssistantMessageOptions) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content,
          isIncomplete: false,
          flowType: options?.flowType,
          flowId: options?.flowId,
          takeoutMessageType: options?.takeoutMessageType,
        },
      ]);
    },
    [setMessages],
  );

  const appendTakeoutCardMessage = useCallback(
    (flowId: number, takeoutMessageType: TakeoutMessageType) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '',
          flowType: 'takeout',
          takeoutMessageType,
          flowId,
        },
      ]);
    },
    [setMessages],
  );

  const appendTakeoutFallbackMessage = useCallback(
    (flowId: number, message = '外卖服务暂时不可用，请稍后再试。') => {
      appendAssistantTextMessage(message, { flowType: 'takeout', flowId });
    },
    [appendAssistantTextMessage],
  );

  const startTakeoutConversation = useCallback(async () => {
    const nextFlowId = Date.now();
    resetModalState();
    setFlowState({
      ...createInitialTakeoutFlowState(nextFlowId),
      isCallingApi: true,
    });

    try {
      const reply = await callDoubaoAPI('识别外卖意图');
      appendAssistantTextMessage(reply, { flowType: 'takeout', flowId: nextFlowId });
      appendTakeoutCardMessage(nextFlowId, 'protocol-card');
      setFlowState((prev) => ({ ...prev, isCallingApi: false }));
    } catch {
      appendTakeoutFallbackMessage(nextFlowId);
      setFlowState((prev) => ({ ...prev, isCallingApi: false }));
    }
  }, [appendAssistantTextMessage, appendTakeoutCardMessage, appendTakeoutFallbackMessage, resetModalState]);

  const openTakeoutAuthorizationModal = useCallback((flowId: number) => {
    if (flowId !== flowState.flowId || flowState.isCallingApi) {
      return;
    }

    setIsTakeoutAgreementChecked(true);
    setModalState((prev) => ({ ...prev, authFlowId: flowId }));
  }, [flowState.flowId, flowState.isCallingApi]);

  const closeTakeoutAuthorizationModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, authFlowId: null }));
  }, []);

  const handleTakeoutAgreement = useCallback(async (flowId: number) => {
    if (flowId !== flowState.flowId) {
      return;
    }

    resetModalState();
    setFlowState((prev) => ({
      ...prev,
      isCallingApi: true,
    }));

    // 协议阶段的文本与卡片只服务于当前分支，确认后直接替换成商品推荐，避免旧卡片继续占据上下文。
    setMessages((prev) => prev.filter((message) => {
      const isCurrentTakeoutAssistantMessage =
        message.role === 'assistant' && message.flowType === 'takeout' && message.flowId === flowId;

      return !isCurrentTakeoutAssistantMessage;
    }));

    try {
      const reply = await callDoubaoAPI('协议同意回复', { address: MOCK_ADDRESS });
      appendAssistantTextMessage(reply, { flowType: 'takeout', flowId });
      appendTakeoutCardMessage(flowId, 'foods-card');
      setFlowState((prev) => ({
        ...prev,
        isCallingApi: false,
        isFoodListVisible: true,
      }));
    } catch {
      appendTakeoutFallbackMessage(flowId);
      setFlowState((prev) => ({ ...prev, isCallingApi: false }));
    }
  }, [appendAssistantTextMessage, appendTakeoutCardMessage, appendTakeoutFallbackMessage, flowState.flowId, resetModalState, setMessages]);

  const handleTakeoutCancel = useCallback((flowId: number) => {
    if (flowId !== flowState.flowId) {
      return;
    }

    closeTakeoutAuthorizationModal();
    appendAssistantTextMessage('已取消授权流程，你可以继续普通聊天或稍后再试外卖功能。', {
      flowType: 'takeout',
      flowId,
    });
  }, [appendAssistantTextMessage, closeTakeoutAuthorizationModal, flowState.flowId]);

  const handleTakeoutSelectFood = useCallback((flowId: number, food: TakeoutFood) => {
    if (flowId !== flowState.flowId) {
      return;
    }

    setFlowState((prev) => ({
      ...prev,
      selectedFood: food,
      selectedCombo: null,
      selectedSnackId: null,
    }));
    setModalState((prev) => ({ ...prev, comboFlowId: flowId }));
  }, [flowState.flowId]);

  const handleTakeoutSelectSnack = useCallback((flowId: number, snackId: string) => {
    if (flowId !== flowState.flowId) {
      return;
    }

    setFlowState((prev) => ({
      ...prev,
      selectedSnackId: snackId,
    }));
  }, [flowState.flowId]);

  const closeTakeoutComboModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, comboFlowId: null }));
  }, []);

  const handleTakeoutSelectCombo = useCallback((flowId: number, combo: TakeoutCombo) => {
    if (flowId !== flowState.flowId) {
      return;
    }

    setFlowState((prev) => ({
      ...prev,
      selectedCombo: combo,
    }));
  }, [flowState.flowId]);

  const handleTakeoutConfirmSelection = useCallback(async (flowId: number) => {
    if (flowId !== flowState.flowId) {
      return;
    }

    closeTakeoutComboModal();
    setFlowState((prev) => ({ ...prev, isCallingApi: true }));

    const userOrderPrompt = buildTakeoutOrderPrompt(flowState);
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: userOrderPrompt,
        isIncomplete: false,
      },
    ]);

    try {
      const reply = await callDoubaoAPI('商品选择完成', { discount: MOCK_DISCOUNT });
      appendAssistantTextMessage(reply, { flowType: 'takeout', flowId });
      appendTakeoutCardMessage(flowId, 'checkout-card');
      setFlowState((prev) => ({
        ...prev,
        isCallingApi: false,
        isCheckoutVisible: true,
        paymentPassword: '',
      }));
    } catch {
      appendTakeoutFallbackMessage(flowId);
      setFlowState((prev) => ({ ...prev, isCallingApi: false }));
    }
  }, [appendAssistantTextMessage, appendTakeoutCardMessage, appendTakeoutFallbackMessage, closeTakeoutComboModal, flowState, setMessages]);

  const openTakeoutPaymentModal = useCallback((flowId: number) => {
    if (flowId !== flowState.flowId || flowState.isCallingApi) {
      return;
    }

    setFlowState((prev) => ({
      ...prev,
      paymentPassword: '',
    }));
    setModalState((prev) => ({ ...prev, paymentFlowId: flowId }));
  }, [flowState.flowId, flowState.isCallingApi]);

  const closeTakeoutPaymentModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, paymentFlowId: null }));
    setFlowState((prev) => ({
      ...prev,
      paymentPassword: '',
    }));
  }, []);

  const handleTakeoutPaymentPasswordChange = useCallback((flowId: number, rawValue: string) => {
    if (flowId !== flowState.flowId) {
      return;
    }

    const nextPassword = rawValue.replace(/\D/g, '').slice(0, 6);
    setFlowState((prev) => ({
      ...prev,
      paymentPassword: nextPassword.length === 6 ? '' : nextPassword,
    }));

    // 支付弹窗是一次性确认流，输满 6 位后立即闭环，避免再多一步「确认支付」按钮打断体验。
    if (nextPassword.length === 6) {
      setModalState((prev) => ({ ...prev, paymentFlowId: null }));
      appendAssistantTextMessage('支付成功，商家正在准备配送，请耐心等待哦~', {
        flowType: 'takeout',
        flowId,
      });
    }
  }, [appendAssistantTextMessage, flowState.flowId]);

  return {
    flowState,
    modalState,
    isTakeoutAgreementChecked,
    setIsTakeoutAgreementChecked,
    foodsScrollerRef,
    paymentInputRef,
    showTakeoutScrollHint,
    startTakeoutConversation,
    openTakeoutAuthorizationModal,
    closeTakeoutAuthorizationModal,
    handleTakeoutAgreement,
    handleTakeoutCancel,
    handleTakeoutSelectFood,
    handleTakeoutSelectSnack,
    closeTakeoutComboModal,
    handleTakeoutSelectCombo,
    handleTakeoutConfirmSelection,
    openTakeoutPaymentModal,
    closeTakeoutPaymentModal,
    handleTakeoutPaymentPasswordChange,
  };
};