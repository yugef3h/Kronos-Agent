import { buildExecutionGraph, getExecutionGraphSuccessors } from '../../buildExecutionGraph.js'

describe('buildExecutionGraph', () => {
  it('builds adjacency and in-degree for a simple chain', () => {
    const built = buildExecutionGraph({
      nodes: [
        { id: 'start-1', data: { type: 'start' } },
        { id: 'llm-1', data: { type: 'llm' } },
        { id: 'end-1', data: { type: 'end' } },
      ],
      edges: [
        { source: 'start-1', target: 'llm-1' },
        { source: 'llm-1', target: 'end-1' },
      ],
    })

    expect(built.ok).toBe(true)
    if (!built.ok) {
      return
    }

    const { graph } = built
    expect(graph.startNodeId).toBe('start-1')
    expect(graph.endNodeIds.has('end-1')).toBe(true)
    expect(graph.inDegree.get('start-1')).toBe(0)
    expect(graph.inDegree.get('llm-1')).toBe(1)
    expect(graph.inDegree.get('end-1')).toBe(1)
    expect(getExecutionGraphSuccessors(graph, 'start-1')).toEqual(['llm-1'])
  })

  it('ignores nested container nodes and cross-boundary edges', () => {
    const built = buildExecutionGraph({
      nodes: [
        { id: 'start-1', data: { type: 'start' } },
        { id: 'loop-1', data: { type: 'loop' } },
        { id: 'loop-start-1', parentId: 'loop-1', data: { type: 'loop-start' } },
        { id: 'end-1', data: { type: 'end' } },
      ],
      edges: [
        { source: 'start-1', target: 'loop-1' },
        { source: 'loop-start-1', target: 'end-1' },
        { source: 'loop-1', target: 'end-1' },
      ],
    })

    expect(built.ok).toBe(true)
    if (!built.ok) {
      return
    }

    expect(built.graph.nodes.has('loop-start-1')).toBe(false)
    expect(built.graph.adjacency.get('start-1')).toEqual(['loop-1'])
    expect(built.graph.adjacency.get('loop-1')).toEqual(['end-1'])
  })

  it('filters successors by if-else branch handle', () => {
    const built = buildExecutionGraph({
      nodes: [
        { id: 'start-1', data: { type: 'start' } },
        { id: 'if-1', data: { type: 'if-else' } },
        { id: 'llm-true', data: { type: 'llm' } },
        { id: 'llm-false', data: { type: 'llm' } },
        { id: 'end-1', data: { type: 'end' } },
      ],
      edges: [
        { source: 'start-1', target: 'if-1', sourceHandle: 'out' },
        { source: 'if-1', target: 'llm-true', sourceHandle: 'true' },
        { source: 'if-1', target: 'llm-false', sourceHandle: 'false' },
        { source: 'llm-true', target: 'end-1', sourceHandle: 'out' },
        { source: 'llm-false', target: 'end-1', sourceHandle: 'out' },
      ],
    })

    expect(built.ok).toBe(true)
    if (!built.ok) {
      return
    }

    expect(getExecutionGraphSuccessors(built.graph, 'if-1', 'true')).toEqual(['llm-true'])
    expect(getExecutionGraphSuccessors(built.graph, 'if-1', 'false')).toEqual(['llm-false'])
  })

  it('reports missing start node', () => {
    const built = buildExecutionGraph({
      nodes: [{ id: 'end-1', data: { type: 'end' } }],
      edges: [],
    })

    expect(built).toMatchObject({
      ok: false,
      issues: [{ code: 'missing_start' }],
    })
  })
})
