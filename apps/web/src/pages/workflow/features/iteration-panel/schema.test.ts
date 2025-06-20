import {
  buildIterationChildren,
  createDefaultIterationNodeConfig,
  deriveIterationOutputType,
  normalizeIterationNodeConfig,
  validateIterationNodeConfig,
} from './schema'

describe('iteration-panel schema', () => {
  it('creates a valid default container config', () => {
    const config = createDefaultIterationNodeConfig('iteration-1')

    expect(config.start_node_id).toBe('iteration-1__iteration_start')
    expect(config.parallel_nums).toBe(10)
    expect(config.flatten_output).toBe(true)
  })

  it('normalizes invalid values and keeps deterministic start node id', () => {
    const config = normalizeIterationNodeConfig({
      is_parallel: true,
      parallel_nums: 999,
      flatten_output: false,
      error_handle_mode: 'continue_on_error',
    }, 'iteration-2')

    expect(config.start_node_id).toBe('iteration-2__iteration_start')
    expect(config.parallel_nums).toBe(50)
    expect(config.error_handle_mode).toBe('continue_on_error')
    expect(config.flatten_output).toBe(false)
  })

  it('derives output types from variable options', () => {
    expect(deriveIterationOutputType({
      label: 'current.item',
      valueSelector: ['iteration-1', 'item'],
      valueType: 'file',
      source: 'node',
    })).toBe('arrayFile')
  })

  it('builds runtime children and validates missing selectors', () => {
    expect(buildIterationChildren('iteration-3__iteration_start')).toEqual([
      {
        nodeId: 'iteration-3__iteration_start',
        nodeType: 'iteration-start',
      },
    ])

    const issues = validateIterationNodeConfig(createDefaultIterationNodeConfig('iteration-3'))
    expect(issues.map(issue => issue.path)).toEqual(['iterator_selector', 'output_selector'])
  })
})