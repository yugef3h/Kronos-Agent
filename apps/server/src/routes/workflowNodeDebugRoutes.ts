import type { Request, Response } from 'express'
import { Router } from 'express'
import {
  NodeDebugExecutorNotFoundError,
  executeNodeDebug,
} from '../workflow/nodeDebugExecutors.js'
import { parseNodeDebugRequestBody } from './workflowNodeDebugRequest.js'

export const NODE_DEBUG_EXECUTOR_NOT_FOUND_CODE = 'node_debug_executor_not_found'

export { parseNodeDebugRequestBody } from './workflowNodeDebugRequest.js'
export type { NodeDebugRouteRequestBody, ParseNodeDebugRequestResult } from './workflowNodeDebugRequest.js'
export { nodeDebugBlockKindSchema, nodeDebugRequestSchema } from './workflowNodeDebugRequest.js'

export const workflowNodeDebugRoutes = Router()

workflowNodeDebugRoutes.post('/workflow/debug/node', async (request: Request, response: Response) => {
  const parsedRequest = parseNodeDebugRequestBody(request.body)
  if (parsedRequest.ok === false) {
    response.status(parsedRequest.status).json(parsedRequest.payload)
    return
  }

  try {
    const result = await executeNodeDebug(parsedRequest.request)
    response.json({ result })
  } catch (error) {
    if (error instanceof NodeDebugExecutorNotFoundError) {
      response.status(404).json({
        error: error.message,
        code: NODE_DEBUG_EXECUTOR_NOT_FOUND_CODE,
        kind: error.kind,
      })
      return
    }

    const message = error instanceof Error ? error.message : 'unknown error'
    response.status(500).json({
      error: `Node debug failed: ${message}`,
      code: 'node_debug_failed',
    })
  }
})
