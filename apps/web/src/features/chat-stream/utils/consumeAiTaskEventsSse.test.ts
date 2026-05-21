import type { AiTaskSseEvent } from '../../../types/chatAsyncTask';
import { mapAiTaskEventToHandlers } from './consumeAiTaskEventsSse';

describe('mapAiTaskEventToHandlers', () => {
  it('maps content events', () => {
    const onContent = jest.fn();
    const event: AiTaskSseEvent = {
      id: 1,
      taskId: 't1',
      type: 'content',
      data: { content: 'hello' },
      timestamp: 1,
    };

    mapAiTaskEventToHandlers(event, {
      onContent,
      onTimeline: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
      shouldContinue: () => true,
    });

    expect(onContent).toHaveBeenCalledWith('hello');
  });

  it('maps done to onComplete', () => {
    const onComplete = jest.fn();
    mapAiTaskEventToHandlers(
      {
        id: 2,
        taskId: 't1',
        type: 'done',
        data: { text: 'done' },
        timestamp: 2,
      },
      {
        onContent: jest.fn(),
        onTimeline: jest.fn(),
        onComplete,
        onError: jest.fn(),
        shouldContinue: () => true,
      },
    );

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('stops when shouldContinue is false', () => {
    const onContent = jest.fn();
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
        onTimeline: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn(),
        shouldContinue: () => false,
      },
    );

    expect(onContent).not.toHaveBeenCalled();
  });
});
