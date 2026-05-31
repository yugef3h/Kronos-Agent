import { executeEndNodeDebug } from '../debug/endNodeDebugExecutor.js'
import {
  applyNodeExecutionToRunContext,
  fromNodeDebugResult,
  toNodeDebugRequest,
} from '../runner/executorBridge.js'
import type { NodeExecutor } from '../nodeExecutors.js'

export const executeEndNode: NodeExecutor = async (request) => {
  const debugResult = await executeEndNodeDebug(toNodeDebugRequest(request))
  const result = fromNodeDebugResult(debugResult)
  applyNodeExecutionToRunContext(request.context, result)
  return result
}
