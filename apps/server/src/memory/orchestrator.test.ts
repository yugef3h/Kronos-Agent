import type { Message } from '../domain/sessionStore';
import { createMemoryPlan } from './orchestrator';

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
    expect(result.summaryArchiveMessageCount).toBe(14 - 8);
  });

  it('should not nest legacy 已有摘要 prefix on rolling merges', () => {
    const messages = createMessages(22);

    const first = createMemoryPlan({
      prompt: '继续',
      messages: messages.slice(0, 14),
      memoryState: {
        summary: '',
        summaryUpdatedAt: null,
      },
    });

    expect(first.summaryUpdated).toBe(true);

    const second = createMemoryPlan({
      prompt: '继续',
      messages,
      memoryState: {
        summary: first.memorySummary,
        summaryUpdatedAt: Date.now(),
        summaryArchiveMessageCount: first.summaryArchiveMessageCount,
      },
    });

    expect(second.summaryUpdated).toBe(true);
    expect(second.memorySummary.match(/已有摘要:/g)?.length ?? 0).toBe(0);
    expect(second.memorySummary).toContain('新增对话摘要:');
  });

  it('should unwrap legacy nested 已有摘要 when merging', () => {
    const messages = createMessages(14);
    const corrupted = '已有摘要:\n已有摘要:\nold digest';

    const result = createMemoryPlan({
      prompt: '继续',
      messages,
      memoryState: {
        summary: corrupted,
        summaryUpdatedAt: Date.now(),
        summaryArchiveMessageCount: 0,
      },
    });

    expect(result.summaryUpdated).toBe(true);
    expect(result.memorySummary).not.toMatch(/^已有摘要:/);
    expect(result.memorySummary).toContain('old digest');
  });

  it('should not duplicate summary when applying the same transcript twice', () => {
    const messages = createMessages(12);

    const first = createMemoryPlan({
      prompt: '继续',
      messages,
      memoryState: {
        summary: '',
        summaryUpdatedAt: null,
      },
    });

    expect(first.summaryUpdated).toBe(true);
    expect(first.summaryArchiveMessageCount).toBe(12 - 8);

    const second = createMemoryPlan({
      prompt: '继续',
      messages,
      memoryState: {
        summary: first.memorySummary,
        summaryUpdatedAt: first.summaryUpdated ? Date.now() : null,
        summaryArchiveMessageCount: first.summaryArchiveMessageCount,
      },
    });

    expect(second.summaryUpdated).toBe(false);
    expect(second.memorySummary).toBe(first.memorySummary);
    expect(second.summaryArchiveMessageCount).toBe(first.summaryArchiveMessageCount);
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
