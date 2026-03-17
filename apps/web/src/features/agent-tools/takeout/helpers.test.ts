import { MOCK_ADDRESS, MOCK_DELIVERY, MOCK_DISCOUNT, MOCK_FOODS } from './data/mockData';
import {
  buildTakeoutComboSummary,
  buildTakeoutOrderPrompt,
  createInitialTakeoutFlowState,
  getTakeoutPaymentSummary,
  getTakeoutQuickActionPrompt,
  getSelectedTakeoutSnackName,
  isTakeoutIntentPrompt,
  isTakeoutWideCardMessage,
} from './helpers';

describe('takeout helpers', () => {
  it('creates an empty flow state with a custom flow id', () => {
    expect(createInitialTakeoutFlowState(42)).toEqual({
      flowId: 42,
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
  });

  it('matches common takeout prompts', () => {
    expect(isTakeoutIntentPrompt('帮我点外卖')).toBe(true);
    expect(isTakeoutIntentPrompt('订一份牛肉面')).toBe(true);
    expect(isTakeoutIntentPrompt('帮我整理今天的会议纪要')).toBe(false);
  });

  it('builds the quick action prompt without overwriting an existing prompt', () => {
    expect(getTakeoutQuickActionPrompt('')).toBe('帮我点外卖');
    expect(getTakeoutQuickActionPrompt('今天中午吃什么')).toBe('今天中午吃什么');
  });

  it('builds stable combo and order summaries from the selected options', () => {
    const flowState = {
      ...createInitialTakeoutFlowState(1),
      selectedFood: MOCK_FOODS[0],
      selectedCombo: MOCK_FOODS[0].combos[1],
      selectedSnackId: 'snack-popcorn',
    };

    expect(getSelectedTakeoutSnackName(flowState.selectedSnackId)).toBe('鸡米花');
    expect(buildTakeoutComboSummary(flowState)).toContain('鸡米花');
    expect(buildTakeoutOrderPrompt(flowState)).toBe('Kronos，帮我下单 招牌牛肉面 + 牛肉面 + 冰红茶 + 鸡米花');
  });

  it('computes payment totals from the selected items and discount', () => {
    const paymentSummary = getTakeoutPaymentSummary({
      selectedFood: MOCK_FOODS[1],
      selectedCombo: MOCK_FOODS[1].combos[0],
    }, MOCK_DISCOUNT);

    expect(paymentSummary.rawPrice).toBe(40);
    expect(paymentSummary.finalPrice).toBe(33.6);
    expect(paymentSummary.savedPrice).toBe(6.4);
  });

  it('recognizes wide card messages that need special chat bubble layout', () => {
    expect(isTakeoutWideCardMessage({
      role: 'assistant',
      content: '',
      flowType: 'takeout',
      takeoutMessageType: 'foods-card',
      flowId: 1,
    })).toBe(true);

    expect(isTakeoutWideCardMessage({
      role: 'assistant',
      content: '普通消息',
      flowType: 'takeout',
      takeoutMessageType: 'protocol-card',
      flowId: 1,
    })).toBe(false);
  });
});