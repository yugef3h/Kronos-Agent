import type { Message } from '../domain/sessionStore';
import { createMemoryPlan } from './memoryOrchestrator';

const createMessages = (count: number): Message[] => {
  return Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `message_${index + 1} ${'detail '.repeat(10)}`,
  }));
};

describe('createMemoryPlan', () => {
  it('should generate rolling summary after enough rounds', () => {
    const messages = createMessages(14);

    const result = createMemoryPlan({
      prompt: '给我总结重点',
      messages,
      memoryState: {
        summary: '',
        summaryUpdatedAt: null,
      },
    });

    expect(result.summaryUpdated).toBe(true);
    expect(result.memorySummary.length).toBeGreaterThan(0);
    expect(result.history.length).toBeLessThanOrEqual(8);
  });

  it('should trim history when token budget is exceeded', () => {
    const longText = 'A'.repeat(10000);
    const messages: Message[] = [
      { role: 'user', content: longText },
      { role: 'assistant', content: longText },
      { role: 'user', content: longText },
      { role: 'assistant', content: longText },
      { role: 'user', content: longText },
      { role: 'assistant', content: longText },
      { role: 'user', content: longText },
      { role: 'assistant', content: longText },
    ];

    const result = createMemoryPlan({
      prompt: '请继续',
      messages,
      memoryState: {
        summary: '',
        summaryUpdatedAt: null,
      },
    });

    expect(result.history.length).toBeLessThan(messages.length);
    expect(result.diagnostics.totalInputTokensEstimate).toBeLessThanOrEqual(result.diagnostics.budgetTokensEstimate);
  });
});
