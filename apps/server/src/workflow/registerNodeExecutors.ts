import { registerNodeExecutor } from './nodeExecutors.js'
import { executeKnowledgeRetrievalNode } from './executors/knowledgeRetrievalNodeExecutor.js'
import { executeLlmNode } from './executors/llmNodeExecutor.js'
import { executeStartNode } from './executors/startNodeExecutor.js'

let hasRegisteredBuiltInExecutors = false

export const registerBuiltInNodeExecutors = (): void => {
  if (hasRegisteredBuiltInExecutors) {
    return
  }

  registerNodeExecutor('start', executeStartNode)
  registerNodeExecutor('llm', executeLlmNode)
  registerNodeExecutor('knowledge-retrieval', executeKnowledgeRetrievalNode)
  hasRegisteredBuiltInExecutors = true
}

registerBuiltInNodeExecutors()
