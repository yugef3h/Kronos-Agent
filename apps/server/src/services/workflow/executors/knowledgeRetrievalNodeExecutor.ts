import { executeKnowledgeRetrievalNodeDebug } from '../debug/knowledgeRetrievalNodeDebugExecutor.js'
import {
  applyNodeExecutionToRunContext,
  fromNodeDebugResult,
  toNodeDebugRequest,
} from '../runner/executorBridge.js'
import type { NodeExecutor } from './nodeExecutors.js'

export const executeKnowledgeRetrievalNode: NodeExecutor = async (request) => {
  const debugResult = await executeKnowledgeRetrievalNodeDebug(toNodeDebugRequest(request))
  const result = fromNodeDebugResult(debugResult)
  applyNodeExecutionToRunContext(request.context, result)
  return result
}
