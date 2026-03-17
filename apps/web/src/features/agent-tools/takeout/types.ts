import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { ChatMessage } from '../../../types/chat';
import type { TakeoutCombo, TakeoutDelivery, TakeoutFood } from './data/mockData';

export type TakeoutMessageType = 'protocol-card' | 'foods-card' | 'checkout-card';

export type TakeoutChatMessage = ChatMessage & {
  isIncomplete?: boolean;
  flowType?: 'takeout';
  takeoutMessageType?: TakeoutMessageType;
  flowId?: number;
};

export type TakeoutFlowState = {
  flowId: number;
  requestPrompt: string;
  foods: TakeoutFood[];
  selectedFood: TakeoutFood | null;
  selectedCombo: TakeoutCombo | null;
  selectedSnackId: string | null;
  isFoodListVisible: boolean;
  isCheckoutVisible: boolean;
  isCallingApi: boolean;
  address: string;
  discount: number;
  delivery: TakeoutDelivery;
  paymentPassword: string;
};

export type TakeoutModalState = {
  authFlowId: number | null;
  comboFlowId: number | null;
  paymentFlowId: number | null;
};

export type TakeoutSnackOption = {
  id: string;
  name: string;
  count: string;
};

export type TakeoutMessageUpdater = Dispatch<SetStateAction<TakeoutChatMessage[]>>;

export type TakeoutAssistantMessageOptions = {
  flowType?: TakeoutChatMessage['flowType'];
  flowId?: number;
  takeoutMessageType?: TakeoutMessageType;
};

export type TakeoutPaymentInputRef = RefObject<HTMLInputElement>;