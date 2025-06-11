import { BlockEnum } from '../types/common'
import { resolvePanelBlockType } from './panel-resolver'

describe('panel-resolver', () => {
  it('maps workflow trigger nodes to the start panel block', () => {
    expect(resolvePanelBlockType('workflow', { kind: 'trigger' })).toBe(BlockEnum.Start)
  })

  it('maps workflow agent nodes to the llm panel block', () => {
    expect(resolvePanelBlockType('workflow', { kind: 'agent' })).toBe(BlockEnum.LLM)
  })

  it('maps workflow llm nodes to the llm panel block', () => {
    expect(resolvePanelBlockType('workflow', { kind: 'llm' })).toBe(BlockEnum.LLM)
  })

  it('maps workflow condition nodes to the if-else panel block', () => {
    expect(resolvePanelBlockType('workflow', { kind: 'condition' })).toBe(BlockEnum.IfElse)
  })

  it('maps workflow loop and iteration nodes to their panel blocks', () => {
    expect(resolvePanelBlockType('workflow', { kind: 'loop' })).toBe(BlockEnum.Loop)
    expect(resolvePanelBlockType('workflow', { kind: 'iteration' })).toBe(BlockEnum.Iteration)
  })

  it('keeps legacy custom node mapping working', () => {
    expect(resolvePanelBlockType('custom', { type: BlockEnum.End })).toBe(BlockEnum.End)
  })

  it('returns undefined for unsupported node payloads', () => {
    expect(resolvePanelBlockType('workflow', {})).toBeUndefined()
    expect(resolvePanelBlockType('unknown', { kind: 'trigger' })).toBeUndefined()
  })
})
