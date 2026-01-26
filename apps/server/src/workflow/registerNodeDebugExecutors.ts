import { executeStartNodeDebug } from './debug/startNodeDebugExecutor.js'
import { registerNodeDebugExecutor } from './nodeDebugExecutors.js'

let hasRegisteredBuiltInExecutors = false

export const registerBuiltInNodeDebugExecutors = (): void => {
  if (hasRegisteredBuiltInExecutors) {
    return
  }

  registerNodeDebugExecutor('start', executeStartNodeDebug)
  hasRegisteredBuiltInExecutors = true
}

registerBuiltInNodeDebugExecutors()
