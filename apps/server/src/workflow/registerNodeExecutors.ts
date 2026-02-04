import { registerNodeExecutor } from './nodeExecutors.js'
import { executeIfElseNode } from './executors/ifElseNodeExecutor.js'
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
  registerNodeExecutor('if-else', executeIfElseNode)
  hasRegisteredBuiltInExecutors = true
}

registerBuiltInNodeExecutors()
