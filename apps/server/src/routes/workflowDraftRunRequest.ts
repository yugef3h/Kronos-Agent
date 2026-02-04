import { z } from 'zod'

const recordSchema = z.record(z.string(), z.unknown())

export const startWorkflowDraftRunSchema = z.object({
  dsl: z.unknown(),
  inputs: recordSchema.optional(),
  options: z
    .object({
      timeoutMs: z.number().int().positive().optional(),
      maxSteps: z.number().int().positive().max(512).optional(),
    })
    .optional(),
})

export type StartWorkflowDraftRunBody = z.infer<typeof startWorkflowDraftRunSchema>

export const parseStartWorkflowDraftRunBody = (body: unknown) =>
  startWorkflowDraftRunSchema.safeParse(body)
