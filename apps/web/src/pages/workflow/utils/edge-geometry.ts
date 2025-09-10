export const WORKFLOW_EDGE_CURVATURE = 0.16;
export const APPEND_TRIGGER_HANDLE_SIZE = 24;
export const WORKFLOW_EDGE_STROKE_WIDTH = 1;
export const APPEND_TRIGGER_SOURCE_OFFSET = APPEND_TRIGGER_HANDLE_SIZE / 2;

export const resolveWorkflowSourceX = (sourceX: number): number => {
  return sourceX - APPEND_TRIGGER_SOURCE_OFFSET;
};