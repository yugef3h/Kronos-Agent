export type PointerPosition = {
  x: number;
  y: number;
};

export type AppendHandlePointerState = {
  start: PointerPosition | null;
  suppressClick: boolean;
};

export const APPEND_HANDLE_DRAG_THRESHOLD = 4;

export const createAppendHandlePointerState = (): AppendHandlePointerState => ({
  start: null,
  suppressClick: false,
});

export const beginAppendHandlePointerState = (
  point: PointerPosition,
): AppendHandlePointerState => ({
  start: point,
  suppressClick: false,
});

export const updateAppendHandlePointerState = (
  state: AppendHandlePointerState,
  point: PointerPosition,
  threshold = APPEND_HANDLE_DRAG_THRESHOLD,
): AppendHandlePointerState => {
  if (!state.start || state.suppressClick) {
    return state;
  }

  const deltaX = Math.abs(point.x - state.start.x);
  const deltaY = Math.abs(point.y - state.start.y);

  if (deltaX + deltaY <= threshold) {
    return state;
  }

  return {
    ...state,
    suppressClick: true,
  };
};

export const endAppendHandlePointerState = (
  state: AppendHandlePointerState,
): AppendHandlePointerState => ({
  ...state,
  start: null,
});

export const consumeAppendHandleClick = (state: AppendHandlePointerState) => ({
  shouldOpen: !state.suppressClick,
  nextState: createAppendHandlePointerState(),
});