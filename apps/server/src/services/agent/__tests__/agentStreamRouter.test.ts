import { describe, expect, it, jest } from '@jest/globals';
import type { LangChainStreamEvent } from '../../chat/streamEventTypes.js';

const linearEvents: LangChainStreamEvent[] = [
  { type: 'timeline', stage: 'plan', status: 'start', message: 'linear', timestamp: 1 },
];

const graphEvents: LangChainStreamEvent[] = [
  { type: 'timeline', stage: 'plan', status: 'start', message: 'graph', timestamp: 1 },
];

jest.mock('../../langgraph/langGraphChatStream.js', () => ({
  streamLangGraphChatReply: async function* () {
    for (const event of graphEvents) {
      yield event;
    }
    throw new Error('graph failed');
  },
}));

jest.mock('../../linear/linearChatStream.js', () => ({
  streamLinearChatReply: async function* () {
    for (const event of linearEvents) {
      yield event;
    }
  },
}));

jest.mock('../../../core/config/env.js', () => ({
  env: {
    LANGGRAPH_ENABLED: true,
  },
}));

import { streamPlaygroundAgentReply } from '../agentStreamRouter.js';

describe('streamPlaygroundAgentReply', () => {
  it('falls back to linear when langgraph throws', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const events = [];

      for await (const event of streamPlaygroundAgentReply({
        prompt: 'hello',
        history: [],
        sessionId: 'sess-1',
      })) {
        events.push(event);
      }

      expect(events.some((item) => item.type === 'timeline' && item.message.includes('graph'))).toBe(
        true,
      );
      expect(
        events.some((item) => item.type === 'timeline' && item.message.includes('线性兜底')),
      ).toBe(true);
      expect(events.some((item) => item.type === 'timeline' && item.message === 'linear')).toBe(
        true,
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
