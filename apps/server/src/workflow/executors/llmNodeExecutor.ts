import { executeLlmNodeDebug } from '../debug/llmNodeDebugExecutor.js'
import {
  applyNodeExecutionToRunContext,
  fromNodeDebugResult,
  toNodeDebugRequest,
} from '../executorBridge.js'
import type { NodeExecutor } from '../nodeExecutors.js'

export const executeLlmNode: NodeExecutor = async (request) => {
  const debugResult = await executeLlmNodeDebug(toNodeDebugRequest(request))
  const result = fromNodeDebugResult(debugResult)
  applyNodeExecutionToRunContext(request.context, result)
  return result
}
