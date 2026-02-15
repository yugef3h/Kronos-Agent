import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { Node } from 'reactflow'
import type { WorkflowDSL } from '../../app/workflowAppStore'
import {
  cancelWorkflowDraftRun,
  startWorkflowDraftRun,
  subscribeWorkflowDraftRunEvents,
  type WorkflowRunEvent,
} from '../../app/workflowRunApi'
import type { CanvasNodeData } from '../types/canvas'
import type { Edge } from '../types/common'
import { WorkflowRunStatus, type WorkflowRunSummary } from '../types/run'
import {
  applyNodeLastRunsFromDraftRun,
  applyWorkflowDraftNodeRunsToCanvas,
  applyWorkflowRunEventToCanvas,
  clearWorkflowRunCanvasState,
} from '../utils/apply-run-event-to-canvas'

type CanvasSnapshot = {
  nodes: Array<Node<CanvasNodeData>>
  edges: Edge[]
}

export type UseWorkflowDraftRunOptions = {
  appId?: string | null
  getCanvas: () => CanvasSnapshot
  setNodes: Dispatch<SetStateAction<Array<Node<CanvasNodeData>>>>
  setEdges: Dispatch<SetStateAction<Edge[]>>
}

const replayWorkflowRunEvents = (
  appId: string,
  runId: string,
  applyEvent: (event: WorkflowRunEvent) => void,
): Promise<void> => new Promise((resolve) => {
  let settled = false
  const finish = () => {
    if (settled) {
      return
    }

    settled = true
    resolve()
  }

  const unsubscribe = subscribeWorkflowDraftRunEvents(appId, runId, {
    onEvent: (event) => {
      applyEvent(event)

      if (event.type === 'workflow_finished') {
        unsubscribe()
        finish()
      }
    },
    onError: () => {
      unsubscribe()
      finish()
    },
  })

  globalThis.setTimeout(() => {
    unsubscribe()
    finish()
  }, 4_000)
})

export const useWorkflowDraftRun = ({
  appId,
  getCanvas,
  setNodes,
  setEdges,
}: UseWorkflowDraftRunOptions) => {
  const [runSummary, setRunSummary] = useState<WorkflowRunSummary | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeRunIdRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const applyCanvas = useCallback((transform: (snapshot: CanvasSnapshot) => CanvasSnapshot) => {
    const { nodes, edges } = transform(getCanvas())
    setNodes(nodes)
    setEdges(edges)
  }, [getCanvas, setEdges, setNodes])

  const clearRunVisuals = useCallback(() => {
    applyCanvas((snapshot) => clearWorkflowRunCanvasState(snapshot.nodes, snapshot.edges))
    setRunSummary(null)
    setError(null)
    activeRunIdRef.current = null
  }, [applyCanvas])

  const applyEvent = useCallback((event: WorkflowRunEvent) => {
    applyCanvas((snapshot) => applyWorkflowRunEventToCanvas(snapshot.nodes, snapshot.edges, event))
  }, [applyCanvas])

  const executeDraftRun = useCallback(async (
    dsl: WorkflowDSL,
    inputs?: Record<string, unknown>,
  ) => {
    const trimmedAppId = appId?.trim()
    if (!trimmedAppId) {
      setError('缺少工作流 appId，无法测试运行。')
      return null
    }

    abortRef.current?.abort()
    const abortController = new AbortController()
    abortRef.current = abortController

    setIsRunning(true)
    setError(null)
    applyCanvas((snapshot) => clearWorkflowRunCanvasState(snapshot.nodes, snapshot.edges))
    setRunSummary({
      runId: '',
      appId: trimmedAppId,
      status: WorkflowRunStatus.Running,
      startedAt: Date.now(),
    })

    try {
      const response = await startWorkflowDraftRun(trimmedAppId, {
        dsl,
        inputs,
      })

      if (abortController.signal.aborted) {
        return null
      }

      const { run, nodeRuns } = response
      activeRunIdRef.current = run.runId
      setRunSummary(run)

      await replayWorkflowRunEvents(trimmedAppId, run.runId, applyEvent)

      if (abortController.signal.aborted) {
        return null
      }

      applyCanvas((snapshot) => {
        const withStatuses = applyWorkflowDraftNodeRunsToCanvas(
          snapshot.nodes,
          snapshot.edges,
          nodeRuns,
        )

        return {
          nodes: applyNodeLastRunsFromDraftRun(withStatuses.nodes, run.runId, nodeRuns),
          edges: withStatuses.edges,
        }
      })

      setRunSummary(run)
      return { run, nodeRuns }
    } catch (caught) {
      if (!abortController.signal.aborted) {
        const message = caught instanceof Error ? caught.message : '测试运行失败'
        setError(message)
        setRunSummary((current) => current
          ? { ...current, status: WorkflowRunStatus.Failed, finishedAt: Date.now() }
          : null)
      }

      return null
    } finally {
      if (abortRef.current === abortController) {
        abortRef.current = null
      }

      setIsRunning(false)
    }
  }, [appId, applyCanvas, applyEvent])

  const cancelDraftRun = useCallback(async () => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsRunning(false)

    const trimmedAppId = appId?.trim()
    const runId = activeRunIdRef.current

    if (!trimmedAppId || !runId) {
      return
    }

    try {
      const response = await cancelWorkflowDraftRun(trimmedAppId, runId)
      setRunSummary(response.run)
    } catch {
      // Sync runs may already be finished; ignore cancel errors.
    }
  }, [appId])

  const isDraftRunActive = isRunning
    || runSummary?.status === WorkflowRunStatus.Running

  return {
    runSummary,
    isRunning,
    isDraftRunActive,
    error,
    executeDraftRun,
    cancelDraftRun,
    clearRunVisuals,
    clearError: () => setError(null),
  }
}
