import {
  APPEND_HANDLE_DRAG_THRESHOLD,
  beginAppendHandlePointerState,
  consumeAppendHandleClick,
  createAppendHandlePointerState,
  endAppendHandlePointerState,
  updateAppendHandlePointerState,
} from './append-handle-pointer';

describe('append-handle-pointer', () => {
  it('keeps clicks enabled when movement stays within the threshold', () => {
    const state = updateAppendHandlePointerState(
      beginAppendHandlePointerState({ x: 24, y: 12 }),
      { x: 26, y: 13 },
    );

    expect(state.suppressClick).toBe(false);
    expect(consumeAppendHandleClick(state).shouldOpen).toBe(true);
  });

  it('suppresses clicks after drag-sized movement', () => {
    const state = updateAppendHandlePointerState(
      beginAppendHandlePointerState({ x: 10, y: 10 }),
      { x: 10 + APPEND_HANDLE_DRAG_THRESHOLD + 1, y: 10 },
    );

    expect(state.suppressClick).toBe(true);
    expect(consumeAppendHandleClick(state).shouldOpen).toBe(false);
  });

  it('clears the pointer origin after the pointer is released', () => {
    const state = endAppendHandlePointerState(
      beginAppendHandlePointerState({ x: 4, y: 8 }),
    );

    expect(state.start).toBeNull();
    expect(state.suppressClick).toBe(false);
  });

  it('resets to the default idle state after a click is consumed', () => {
    const result = consumeAppendHandleClick(createAppendHandlePointerState());

    expect(result.shouldOpen).toBe(true);
    expect(result.nextState).toEqual(createAppendHandlePointerState());
  });
});