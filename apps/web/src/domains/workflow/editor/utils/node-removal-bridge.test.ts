import type { Node } from 'reactflow';
import { BlockEnum } from '../types/common';
import type { CanvasNodeData } from '../types/canvas';
import type { Edge } from '../types/common';
import { resolveBridgeEdgeAfterNodeRemoval } from './node-removal-bridge';

const createNode = (
  id: string,
  kind: CanvasNodeData['kind'],
  overrides: Partial<Node<CanvasNodeData>> = {},
): Node<CanvasNodeData> => ({
  id,
  type: 'workflow',
  position: { x: 0, y: 0 },
  data: {
    kind,
    title: id,
    subtitle: id,
  },
  ...overrides,
});

const createEdge = (
  id: string,
  source: string,
  target: string,
  overrides: Partial<Edge> = {},
): Edge => ({
  id,
  source,
  target,
  data: {
    sourceType: BlockEnum.Start,
    targetType: BlockEnum.End,
  },
  ...overrides,
});

describe('resolveBridgeEdgeAfterNodeRemoval', () => {
  it('bridges a simple single-in single-out root node', () => {
    const nodes = [
      createNode('trigger', 'trigger'),
      createNode('llm-1', 'llm'),
      createNode('end', 'end'),
    ];
    const edges = [
      createEdge('trigger-out-llm-1-in', 'trigger', 'llm-1', { sourceHandle: 'out', targetHandle: 'in' }),
      createEdge('llm-1-out-end-in', 'llm-1', 'end', { sourceHandle: 'out', targetHandle: 'in' }),
    ];

    const bridgeEdge = resolveBridgeEdgeAfterNodeRemoval({
      nodes,
      edges,
      removedNodeId: 'llm-1',
    });

    expect(bridgeEdge).toMatchObject({
      id: 'trigger-out-end-in',
      source: 'trigger',
      target: 'end',
      sourceHandle: 'out',
      targetHandle: 'in',
      data: {
        sourceType: BlockEnum.Start,
        targetType: BlockEnum.End,
        _waitingRun: true,
      },
    });
  });

  it('does not bridge condition branches or non-linear handles', () => {
    const nodes = [
      createNode('condition-1', 'condition'),
      createNode('llm-1', 'llm'),
      createNode('end', 'end'),
    ];
    const edges = [
      createEdge('condition-1-false-llm-1-in', 'condition-1', 'llm-1', {
        sourceHandle: 'false',
        targetHandle: 'in',
        data: {
          sourceType: BlockEnum.IfElse,
          targetType: BlockEnum.LLM,
        },
      }),
      createEdge('llm-1-out-end-in', 'llm-1', 'end', {
        sourceHandle: 'out',
        targetHandle: 'in',
        data: {
          sourceType: BlockEnum.LLM,
          targetType: BlockEnum.End,
        },
      }),
    ];

    const bridgeEdge = resolveBridgeEdgeAfterNodeRemoval({
      nodes,
      edges,
      removedNodeId: 'llm-1',
    });

    expect(bridgeEdge).toBe(null);
  });

  it('does not bridge when the removed node owns descendants', () => {
    const nodes = [
      createNode('trigger', 'trigger'),
      createNode('llm-1', 'llm'),
      createNode('child', 'knowledge', { parentId: 'llm-1' }),
      createNode('end', 'end'),
    ];
    const edges = [
      createEdge('trigger-out-llm-1-in', 'trigger', 'llm-1', { sourceHandle: 'out', targetHandle: 'in' }),
      createEdge('llm-1-out-end-in', 'llm-1', 'end', { sourceHandle: 'out', targetHandle: 'in' }),
    ];

    const bridgeEdge = resolveBridgeEdgeAfterNodeRemoval({
      nodes,
      edges,
      removedNodeId: 'llm-1',
      removedNodeIds: ['llm-1', 'child'],
    });

    expect(bridgeEdge).toBe(null);
  });
});