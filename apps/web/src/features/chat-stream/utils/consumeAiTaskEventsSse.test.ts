import { describe, expect, it, vi } from 'vitest';

import type { AiTaskSseEvent } from '../../../types/chatAsyncTask';
import { mapAiTaskEventToHandlers } from './consumeAiTaskEventsSse';

describe('mapAiTaskEventToHandlers', () => {
  it('maps content events', () => {
    const onContent = vi.fn();
    const event: AiTaskSseEvent = {
      id: 1,
      taskId: 't1',
      type: 'content',
      data: { content: 'hello' },
      timestamp: 1,
    };

    mapAiTaskEventToHandlers(event, {
      onContent,
      onTimeline: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
      shouldContinue: () => true,
    });

    expect(onContent).toHaveBeenCalledWith('hello');
  });

  it('maps done to onComplete', () => {
    const onComplete = vi.fn();
    mapAiTaskEventToHandlers(
      {
        id: 2,
        taskId: 't1',
        type: 'done',
        data: { text: 'done' },
        timestamp: 2,
      },
      {
        onContent: vi.fn(),
        onTimeline: vi.fn(),
        onComplete,
        onError: vi.fn(),
        shouldContinue: () => true,
      },
    );

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('stops when shouldContinue is false', () => {
    const onContent = vi.fn();
    mapAiTaskEventToHandlers(
      {
        id: 3,
        taskId: 't1',
        type: 'content',
        data: { content: 'x' },
        timestamp: 3,
      },
      {
        onContent,
        onTimeline: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
        shouldContinue: () => false,
      },
    );

    expect(onContent).not.toHaveBeenCalled();
  });
});
