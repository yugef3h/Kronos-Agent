import { resolveNodeDebugBlockKind } from './node-debug-kind'

describe('resolveNodeDebugBlockKind', () => {
  it('maps canvas kinds to debug block kinds', () => {
    expect(resolveNodeDebugBlockKind('trigger')).toBe('start')
    expect(resolveNodeDebugBlockKind('knowledge')).toBe('knowledge-retrieval')
    expect(resolveNodeDebugBlockKind('condition')).toBe('if-else')
  })

  it('returns null for container entry nodes', () => {
    expect(resolveNodeDebugBlockKind('loop-start')).toBeNull()
    expect(resolveNodeDebugBlockKind('iteration-end')).toBeNull()
  })
})
