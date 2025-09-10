import {
  APPEND_TRIGGER_SOURCE_OFFSET,
  resolveWorkflowSourceX,
} from './edge-geometry';

describe('edge-geometry', () => {
  it('shifts persisted source anchors back by half of the append-trigger handle width', () => {
    expect(resolveWorkflowSourceX(331)).toBe(331 - APPEND_TRIGGER_SOURCE_OFFSET);
  });
});