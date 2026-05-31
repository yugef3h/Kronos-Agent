import { NodeRunStatus } from '../types.js'
import {
  ELSE_BRANCH_ID,
  evaluateIfElseCondition,
  executeIfElseNodeDebug,
  resolveMatchedIfElseBranch,
} from '../ifElseNodeDebugExecutor.js'

describe('ifElseNodeDebugExecutor', () => {
  it('evaluates numeric greater_than', () => {
    const matched = evaluateIfElseCondition(
      {
        id: 'c1',
        variableSelector: ['trigger-1', 'score'],
        variableType: 'number',
        comparisonOperator: 'greater_than',
        value: 10,
      },
      {
        'trigger-1': { score: 12 },
      },
    )

    expect(matched).toBe(true)
  })

  it('resolves matched IF branch', () => {
    const result = resolveMatchedIfElseBranch(
      {
        cases: [{
          case_id: 'true',
          logical_operator: 'and',
          conditions: [{
            id: 'c1',
            variableSelector: ['trigger-1', 'query'],
            variableType: 'string',
            comparisonOperator: 'contains',
            value: 'RAG',
          }],
        }],
      },
      {
        'trigger-1': { query: '什么是 RAG' },
      },
    )

    expect(result.branchId).toBe('true')
    expect(result.caseIndex).toBe(0)
  })

  it('falls back to ELSE when no case matches', async () => {
    const result = await executeIfElseNodeDebug({
      node: {
        id: 'condition-1',
        type: 'if-else',
        inputs: {
          cases: [{
            case_id: 'true',
            logical_operator: 'and',
            conditions: [{
              id: 'c1',
              variableSelector: ['trigger-1', 'query'],
              variableType: 'string',
              comparisonOperator: 'contains',
              value: 'RAG',
            }],
          }],
        },
      },
      context: {
        variables: {
          'trigger-1': { query: 'hello' },
        },
      },
    })

    expect(result.status).toBe(NodeRunStatus.Succeeded)
    expect(result.outputs?.branchId).toBe(ELSE_BRANCH_ID)
    expect(result.outputs?.isElse).toBe(true)
  })
})
