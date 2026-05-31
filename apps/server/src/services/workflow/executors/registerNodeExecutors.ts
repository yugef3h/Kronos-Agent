import { registerNodeExecutor } from '../executors/nodeExecutors.js'
import { executeEndNode } from '../executors/endNodeExecutor.js'
import { executeIfElseNode } from './ifElseNodeExecutor.js'
import { executeIterationNode } from './iterationNodeExecutor.js'
import { executeLoopNode } from './loopNodeExecutor.js'
import { executeKnowledgeRetrievalNode } from './knowledgeRetrievalNodeExecutor.js'
import { executeLlmNode } from './llmNodeExecutor.js'
import { executeStartNode } from './startNodeExecutor.js'

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
