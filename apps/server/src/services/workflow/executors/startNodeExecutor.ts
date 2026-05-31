import { executeStartNodeDebug } from '../debug/startNodeDebugExecutor.js'
import {
  applyNodeExecutionToRunContext,
  fromNodeDebugResult,
  toNodeDebugRequest,
} from '../executorBridge.js'
import type { NodeExecutor } from '../nodeExecutors.js'

export const executeStartNode: NodeExecutor = async (request) => {
  const debugResult = await executeStartNodeDebug(
    toNodeDebugRequest(request, request.node.inputs),
  )
  const result = fromNodeDebugResult(debugResult)
  applyNodeExecutionToRunContext(request.context, result)
  return result
}
