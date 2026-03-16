import { analyzeTakeoutIntent } from './takeoutIntentService';

describe('takeoutIntentService', () => {
  it('detects high-confidence takeout order with slots', () => {
    const result = analyzeTakeoutIntent({
      prompt: '帮我点一杯少糖生椰拿铁，送到公司，50元内，尽快',
    });

    expect(result.intent).toBe('takeout_order');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.slots.dishType).toBe('咖啡');
    expect(result.slots.addressHint).toBe('公司');
    expect(result.slots.budgetRange).toBe('<=50');
    expect(result.nextAction).toBe('start_takeout_flow');
  });

  it('falls back on non-takeout cooking query', () => {
    const result = analyzeTakeoutIntent({
      prompt: '教我做一份低脂鸡胸肉菜谱',
    });

    expect(result.intent).toBe('non_takeout');
    expect(result.nextAction).toBe('fallback_to_chat');
  });

  it('uses medium confidence recommend path for short prompts', () => {
    const result = analyzeTakeoutIntent({
      prompt: '点咖啡',
    });

    expect(result.intent).toBe('takeout_recommend');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.nextAction).toBe('ask_for_slot');
  });
});
