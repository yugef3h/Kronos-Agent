import { executeEndNodeDebug } from './debug/endNodeDebugExecutor.js'
import { executeKnowledgeRetrievalNodeDebug } from './debug/knowledgeRetrievalNodeDebugExecutor.js'
import { executeIfElseNodeDebug } from './debug/ifElseNodeDebugExecutor.js'
import { executeLlmNodeDebug } from '../debug/llmNodeDebugExecutor.js'
import { executeStartNodeDebug } from './debug/startNodeDebugExecutor.js'
import { registerNodeDebugExecutor } from '../executors/nodeDebugExecutors.js'

let hasRegisteredBuiltInExecutors = false

export const registerBuiltInNodeDebugExecutors = (): void => {
  if (hasRegisteredBuiltInExecutors) {
    return
  }

  registerNodeDebugExecutor('start', executeStartNodeDebug)
  registerNodeDebugExecutor('end', executeEndNodeDebug)
  registerNodeDebugExecutor('if-else', executeIfElseNodeDebug)
  registerNodeDebugExecutor('llm', executeLlmNodeDebug)
  registerNodeDebugExecutor('knowledge-retrieval', executeKnowledgeRetrievalNodeDebug)
  hasRegisteredBuiltInExecutors = true
}

registerBuiltInNodeDebugExecutors()
