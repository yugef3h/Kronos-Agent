import type { Response } from 'express'
import { registerNodeDebugExecutor } from '../services/workflow/executors/nodeDebugExecutors.js'
import { executeStartNodeDebug } from '../services/workflow/debug/startNodeDebugExecutor.js'
import { workflowRunStore } from '../services/workflow/store/workflowRunStore.js'
import { handleWorkflowNodeDebugNodePost } from './workflowNodeDebugRoutes.js'

export type WorkflowNodeDebugHttpResponse = {
  status: number
  body: unknown
}

const createMockResponse = () => {
  let statusCode = 200
  let body: unknown

  const response = {
    status(code: number) {
      statusCode = code
      return this
    },
    json(payload: unknown) {
      body = payload
      return this
    },
  } as unknown as Response

  return {
    response,
    getStatusCode: () => statusCode,
    getBody: () => body,
  }
}

export const invokeWorkflowNodeDebugNodePost = async (
  body: unknown,
): Promise<WorkflowNodeDebugHttpResponse> => {
  const { response, getStatusCode, getBody } = createMockResponse()

  await handleWorkflowNodeDebugNodePost({ body }, response)

  return {
    status: getStatusCode(),
    body: getBody(),
  }
}

export const postWorkflowNodeDebugStart = async (
  body: unknown,
): Promise<WorkflowNodeDebugHttpResponse> => {
  await workflowRunStore.clear()
  registerNodeDebugExecutor('start', executeStartNodeDebug)
  return invokeWorkflowNodeDebugNodePost(body)
}
