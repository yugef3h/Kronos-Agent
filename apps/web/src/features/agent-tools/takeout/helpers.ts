import { MOCK_ADDRESS, MOCK_DELIVERY, MOCK_DISCOUNT } from './data/mockData';
import type { TakeoutChatMessage, TakeoutFlowState, TakeoutSnackOption } from './types';

export const TAKEOUT_SNACK_OPTIONS: TakeoutSnackOption[] = [
  { id: 'snack-fries', name: '脆薯', count: 'x1' },
  { id: 'snack-popcorn', name: '鸡米花', count: 'x1' },
  { id: 'snack-pie', name: '甜派', count: 'x1' },
];

const TAKEOUT_TRIGGER_REGEX = /(点外卖|帮我点|订购|吃|外卖|牛肉面|酸辣粉|黄焖鸡|汉堡|奶茶|米线)/;

export const createInitialTakeoutFlowState = (flowId = 0): TakeoutFlowState => ({
  flowId,
  requestPrompt: '帮我点外卖',
  foods: [],
  selectedFood: null,
  selectedCombo: null,
  selectedSnackId: null,
  isFoodListVisible: false,
  isCheckoutVisible: false,
  isCallingApi: false,
  address: MOCK_ADDRESS,
  discount: MOCK_DISCOUNT,
  delivery: MOCK_DELIVERY,
  paymentPassword: '',
});

export const isTakeoutIntentPrompt = (text: string): boolean => {
  return TAKEOUT_TRIGGER_REGEX.test(text.trim());
};

export const formatTakeoutPrice = (value: number): string => {
  return value.toFixed(1);
};

export const getTakeoutQuickActionPrompt = (currentPrompt: string): string => {
  return currentPrompt || '帮我点外卖';
};

export const getSelectedTakeoutSnackName = (
  selectedSnackId: string | null,
  fallback = '脆薯',
): string => {
  return TAKEOUT_SNACK_OPTIONS.find((item) => item.id === selectedSnackId)?.name || fallback;
};

export const buildTakeoutComboSummary = (
  flowState: Pick<TakeoutFlowState, 'selectedFood' | 'selectedCombo' | 'selectedSnackId'>,
): string => {
  return [
    flowState.selectedFood?.productTip || '',
    flowState.selectedCombo?.name || '标准规格',
  ].filter(Boolean).join(' / ');
};

export const buildTakeoutOrderPrompt = (
  flowState: Pick<TakeoutFlowState, 'selectedFood' | 'selectedCombo' | 'selectedSnackId'>,
): string => {
  const selectedFoodName = flowState.selectedFood?.productName || '套餐';
  const selectedComboName = flowState.selectedCombo?.name || '';
  const orderSummaryParts = [selectedFoodName, selectedComboName].filter(Boolean);

  return `Kronos，帮我下单 ${orderSummaryParts.join(' + ')}`;
};

export const getTakeoutPaymentSummary = (
  flowState: Pick<TakeoutFlowState, 'selectedFood' | 'selectedCombo'>,
  discount = MOCK_DISCOUNT,
) => {
  const selectedFoodPrice = flowState.selectedFood?.price || 32;
  const selectedComboPrice = flowState.selectedCombo?.extraPrice || 0;
  const rawPrice = selectedFoodPrice + selectedComboPrice + 6;
  const finalPrice = Number(Math.max(0, rawPrice - discount).toFixed(1));
  const savedPrice = Number(Math.max(0, rawPrice - finalPrice).toFixed(1));

  return {
    selectedFoodPrice,
    selectedComboPrice,
    rawPrice,
    finalPrice,
    savedPrice,
  };
};

export const isTakeoutCardMessage = (message: TakeoutChatMessage): boolean => {
  return message.flowType === 'takeout' && Boolean(message.takeoutMessageType);
};

export const isTakeoutWideCardMessage = (message: TakeoutChatMessage): boolean => {
  return (
    message.flowType === 'takeout'
    && (message.takeoutMessageType === 'foods-card' || message.takeoutMessageType === 'checkout-card')
  );
};