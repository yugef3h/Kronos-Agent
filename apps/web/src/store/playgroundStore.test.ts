class SessionStorageMock {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key) || null : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('playgroundStore', () => {
  const originalSessionStorage = global.sessionStorage;

  beforeEach(() => {
    Object.defineProperty(global, 'sessionStorage', {
      value: new SessionStorageMock(),
      configurable: true,
      writable: true,
    });
    jest.resetModules();
  });

  afterAll(() => {
    Object.defineProperty(global, 'sessionStorage', {
      value: originalSessionStorage,
      configurable: true,
      writable: true,
    });
  });

  it('keeps chat draft state until the session changes', () => {
    jest.isolateModules(() => {
      const { createInitialMemoryMetrics, usePlaygroundStore } = require('./playgroundStore');
      const { createInitialTakeoutFlowState } = require('../features/agent-tools/takeout/helpers');

      const store = usePlaygroundStore;

      store.getState().setChatMessages([
        { role: 'user', content: '保留这条消息', isIncomplete: false },
      ]);
      store.getState().setChatPrompt('继续刚才的话题');
      store.getState().setPendingFile({
        fileName: 'notes.md',
        mimeType: 'text/markdown',
        size: 128,
        extension: 'md',
        dataUrl: 'data:text/markdown;base64,Zm9v',
      });
      store.getState().setPendingImage({
        fileName: 'meal.png',
        mimeType: 'image/png',
        size: 256,
        dataUrl: 'data:image/png;base64,Zm9v',
      });
      store.getState().setIsAwaitingTakeoutFollowup(true);
      store.getState().setMemoryMetrics((previousValue) => ({
        ...previousValue,
        messageCount: 3,
      }));
      store.getState().setTakeoutFlowState({
        ...createInitialTakeoutFlowState(7),
        isFoodListVisible: true,
      });

      expect(store.getState().chatMessages).toHaveLength(1);
      expect(store.getState().chatPrompt).toBe('继续刚才的话题');
      expect(store.getState().pendingFile?.fileName).toBe('notes.md');
      expect(store.getState().pendingImage?.fileName).toBe('meal.png');
      expect(store.getState().isAwaitingTakeoutFollowup).toBe(true);
      expect(store.getState().memoryMetrics.messageCount).toBe(3);
      expect(store.getState().takeoutFlowState.flowId).toBe(7);

      store.getState().setSessionId('history-session');

      expect(store.getState().sessionId).toBe('history-session');
      expect(store.getState().chatMessages).toEqual([]);
      expect(store.getState().chatPrompt).toBe('');
      expect(store.getState().pendingFile).toBeNull();
      expect(store.getState().pendingImage).toBeNull();
      expect(store.getState().isStreaming).toBe(false);
      expect(store.getState().isOrchestrating).toBe(false);
      expect(store.getState().isAnalyzingImage).toBe(false);
      expect(store.getState().isAwaitingTakeoutFollowup).toBe(false);
      expect(store.getState().memoryMetrics).toEqual(createInitialMemoryMetrics());
      expect(store.getState().takeoutFlowState).toEqual(createInitialTakeoutFlowState());
    });
  });
});