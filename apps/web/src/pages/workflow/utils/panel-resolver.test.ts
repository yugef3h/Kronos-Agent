import { BlockEnum } from '../types/common'
import { resolvePanelBlockType } from './panel-resolver'

describe('panel-resolver', () => {
  it('maps workflow trigger nodes to the start panel block', () => {
    expect(resolvePanelBlockType('workflow', { kind: 'trigger' })).toBe(BlockEnum.Start)
  })

  it('maps workflow agent nodes to the llm panel block', () => {
    expect(resolvePanelBlockType('workflow', { kind: 'agent' })).toBe(BlockEnum.LLM)
  })

  it('keeps legacy custom node mapping working', () => {
    expect(resolvePanelBlockType('custom', { type: BlockEnum.End })).toBe(BlockEnum.End)
  })

  it('returns undefined for unsupported node payloads', () => {
    expect(resolvePanelBlockType('workflow', {})).toBeUndefined()
    expect(resolvePanelBlockType('unknown', { kind: 'trigger' })).toBeUndefined()
  })
})
