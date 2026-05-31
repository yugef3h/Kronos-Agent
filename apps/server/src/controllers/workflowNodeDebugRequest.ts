import { z } from 'zod'
import { normalizeWorkflowAppId } from '../../services/workflow/workflowDraftPreviewDiskStore.js'
import type { NodeDebugBlockKind, NodeDebugRequest } from '../services/workflow/types/types.js'

const NODE_DEBUG_BLOCK_KINDS = [
  'start',
  'end',
  'llm',
  'if-else',
  'knowledge-retrieval',
  'loop',
  'iteration',
] as const satisfies readonly NodeDebugBlockKind[]

const recordSchema = z.record(z.string(), z.unknown())

export const nodeDebugBlockKindSchema = z.enum(NODE_DEBUG_BLOCK_KINDS)

export const nodeDebugRequestSchema = z.object({
  appId: z.string().optional(),
  node: z.object({
    id: z.string().trim().min(1).max(200),
    type: nodeDebugBlockKindSchema,
    inputs: recordSchema.optional(),
    outputs: recordSchema.optional(),
    data: recordSchema.optional(),
  }),
  inputs: recordSchema.optional(),
  context: z
    .object({
      variables: recordSchema.optional(),
    })
    .optional(),
})

export type NodeDebugRouteRequestBody = z.infer<typeof nodeDebugRequestSchema>

export type ParseNodeDebugRequestResult =
  | { ok: true; request: NodeDebugRequest }
  | { ok: false; status: 400; payload: { error: string; code: string } }

export const parseNodeDebugRequestBody = (body: unknown): ParseNodeDebugRequestResult => {
  const parsed = nodeDebugRequestSchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      ok: false,
      status: 400,
      payload: {
        error: firstIssue?.message ?? 'Invalid node debug request body',
        code: 'node_debug_request_invalid',
      },
    }
  }

  const appId = parsed.data.appId?.trim()
  if (appId && !normalizeWorkflowAppId(appId)) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: 'Invalid app id',
        code: 'node_debug_app_id_invalid',
      },
    }
  }

  const { node, inputs, context } = parsed.data

  return {
    ok: true,
    request: {
      ...(appId ? { appId } : {}),
      node: {
        id: node.id,
        type: node.type,
        ...(node.inputs ? { inputs: node.inputs } : {}),
        ...(node.outputs ? { outputs: node.outputs } : {}),
        ...(node.data ? { data: node.data } : {}),
      },
      ...(inputs ? { inputs } : {}),
      ...(context ? { context } : {}),
    },
  }
}
