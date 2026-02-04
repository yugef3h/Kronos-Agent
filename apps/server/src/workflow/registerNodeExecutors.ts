import { registerNodeExecutor } from './nodeExecutors.js'
import { executeStartNode } from './executors/startNodeExecutor.js'

let hasRegisteredBuiltInExecutors = false

export const registerBuiltInNodeExecutors = (): void => {
  if (hasRegisteredBuiltInExecutors) {
    return
  }

  registerNodeExecutor('start', executeStartNode)
  hasRegisteredBuiltInExecutors = true
}

registerBuiltInNodeExecutors()
