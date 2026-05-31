import { executeIfElseNodeDebug } from '../debug/ifElseNodeDebugExecutor.js'
import {
  applyNodeExecutionToRunContext,
  fromNodeDebugResult,
  toNodeDebugRequest,
} from '../runner/executorBridge.js'
import type { NodeExecutor } from './nodeExecutors.js'

export const executeIfElseNode: NodeExecutor = async (request) => {
  const debugResult = await executeIfElseNodeDebug(toNodeDebugRequest(request))
  const result = fromNodeDebugResult(debugResult)
  applyNodeExecutionToRunContext(request.context, result)
  return result
}
