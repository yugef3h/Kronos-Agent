import { executeEndNodeDebug } from './debug/endNodeDebugExecutor.js'
import { executeStartNodeDebug } from './debug/startNodeDebugExecutor.js'
import { registerNodeDebugExecutor } from './nodeDebugExecutors.js'

let hasRegisteredBuiltInExecutors = false

export const registerBuiltInNodeDebugExecutors = (): void => {
  if (hasRegisteredBuiltInExecutors) {
    return
  }

  registerNodeDebugExecutor('start', executeStartNodeDebug)
  registerNodeDebugExecutor('end', executeEndNodeDebug)
  hasRegisteredBuiltInExecutors = true
}

registerBuiltInNodeDebugExecutors()
