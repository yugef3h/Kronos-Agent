import type { Node } from 'reactflow'
import type { CanvasNodeData } from '../types/canvas'
import { BlockEnum, type Edge } from '../types/common'
import { buildCanvasNodeData, createWorkflowDslFromCanvas } from './workflow-dsl'
import { validateRunnableDsl } from './validate-runnable-dsl'

const mkNode = (
  id: string,
  kind: CanvasNodeData['kind'],
  title: string,
): Node<CanvasNodeData> => ({
  id,
  type: 'workflow',
  position: { x: 0, y: 0 },
  data: buildCanvasNodeData({ kind, title, subtitle: '' }),
})

const mkEdge = (
  source: string,
  target: string,
  sourceType: BlockEnum,
  targetType: BlockEnum,
): Edge => ({
  id: `${source}-out-${target}-in`,
  source,
  target,
  sourceHandle: 'out',
  targetHandle: 'in',
  type: 'custom',
  data: {
    sourceType,
    targetType,
  },
})

describe('validateRunnableDsl', () => {
  it('passes when start reaches end through the main graph', () => {
    const dsl = createWorkflowDslFromCanvas(
      [
        mkNode('trigger-1', 'trigger', '用户输入'),
        mkNode('llm-1', 'llm', 'LLM'),
        mkNode('end-1', 'end', '结束'),
      ],
      [
        mkEdge('trigger-1', 'llm-1', BlockEnum.Start, BlockEnum.LLM),
        mkEdge('llm-1', 'end-1', BlockEnum.LLM, BlockEnum.End),
      ],
    )

    expect(validateRunnableDsl(dsl)).toEqual({
      runnable: true,
      issues: [],
    })
  })

  it('fails when end node is missing', () => {
    const dsl = createWorkflowDslFromCanvas(
      [mkNode('trigger-1', 'trigger', '用户输入')],
      [],
    )

    const result = validateRunnableDsl(dsl)
    expect(result.runnable).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toEqual(['missing_end'])
  })

  it('fails when start node is missing', () => {
    const dsl = createWorkflowDslFromCanvas(
      [mkNode('end-1', 'end', '结束')],
      [],
    )

    const result = validateRunnableDsl(dsl)
    expect(result.runnable).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'missing_start')).toBe(true)
  })

  it('fails when start cannot reach end', () => {
    const dsl = createWorkflowDslFromCanvas(
      [
        mkNode('trigger-1', 'trigger', '用户输入'),
        mkNode('llm-1', 'llm', 'LLM'),
        mkNode('end-1', 'end', '结束'),
      ],
      [mkEdge('llm-1', 'end-1', BlockEnum.LLM, BlockEnum.End)],
    )

    const result = validateRunnableDsl(dsl)
    expect(result.runnable).toBe(false)
    expect(result.issues).toEqual([
      {
        code: 'start_not_reachable_end',
        message: '开始节点无法到达任何结束节点',
        nodeId: 'trigger-1',
      },
    ])
  })
})
