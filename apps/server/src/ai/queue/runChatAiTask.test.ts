jest.mock('../../services/agent/agentStreamRouter.js', () => ({
  streamPlaygroundAgentReply: jest.fn(async function* () {
    yield { type: 'content', content: 'hello' };
  }),
}));

import { clearAiTaskEvents } from './aiTaskEvents.js';
import { clearAiTaskStore, createAiTask, getAiTask } from './memoryAiTaskStore.js';
import { runChatAiTask } from './runChatAiTask.js';

describe('runChatAiTask', () => {
  beforeEach(() => {
    clearAiTaskStore();
    clearAiTaskEvents();
  });

  it('marks task succeeded with aggregated text', async () => {
    const record = createAiTask({
      kind: 'chat',
      priority: 3,
      payload: { prompt: 'hi', sessionId: 's1' },
    });

    await runChatAiTask(record.taskId);

    const updated = await getAiTask(record.taskId);
    expect(updated?.status).toBe('succeeded');
    expect((updated?.result as { text?: string })?.text).toBe('hello');
  });
});
