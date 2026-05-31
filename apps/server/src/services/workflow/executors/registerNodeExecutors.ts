import { registerNodeExecutor } from './nodeExecutors.js'
import { executeEndNode } from './executors/endNodeExecutor.js'
import { executeIfElseNode } from './executors/ifElseNodeExecutor.js'
import { executeIterationNode } from './executors/iterationNodeExecutor.js'
import { executeLoopNode } from './executors/loopNodeExecutor.js'
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
  registerNodeExecutor('end', executeEndNode)
  registerNodeExecutor('loop', executeLoopNode)
  registerNodeExecutor('iteration', executeIterationNode)
  hasRegisteredBuiltInExecutors = true
}

registerBuiltInNodeExecutors()
