import { describe, expect, it } from '@jest/globals';
import {
  getWorkflowExampleGraphStats,
  isWorkflowExampleDestructiveDowngrade,
} from './workflowExampleSaveGuard.js';

const dslWithGraph = (nodes: number, edges: number, onlyStart = false) => ({
  workflow: {
    graph: {
      nodes: Array.from({ length: nodes }, (_, i) => ({
        id: `n-${i}`,
        data: { type: onlyStart && i === 0 && nodes === 1 ? 'start' : 'llm' },
      })),
      edges: Array.from({ length: edges }, (_, i) => ({ id: `e-${i}` })),
    },
  },
});

describe('workflowExampleSaveGuard', () => {
  it('detects start-only shell', () => {
    const stats = getWorkflowExampleGraphStats(dslWithGraph(1, 0, true) as Record<string, unknown>);
    expect(stats.onlyStartShell).toBe(true);
  });

  it('blocks downgrade from multi-node graph to start-only', () => {
    const existing = getWorkflowExampleGraphStats(dslWithGraph(4, 3) as Record<string, unknown>);
    const incoming = getWorkflowExampleGraphStats(dslWithGraph(1, 0, true) as Record<string, unknown>);
    expect(isWorkflowExampleDestructiveDowngrade(existing, incoming)).toBe(true);
  });

  it('allows upgrade after accidental wipe on disk', () => {
    const existing = getWorkflowExampleGraphStats(dslWithGraph(1, 0, true) as Record<string, unknown>);
    const incoming = getWorkflowExampleGraphStats(dslWithGraph(4, 3) as Record<string, unknown>);
    expect(isWorkflowExampleDestructiveDowngrade(existing, incoming)).toBe(false);
  });
});
