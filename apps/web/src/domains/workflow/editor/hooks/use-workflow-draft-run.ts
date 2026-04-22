import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { Node } from 'reactflow'
import type { WorkflowDSL } from '../../app/workflowAppStore'
import {
  cancelWorkflowDraftRun,
  isDeferredWorkflowDraftRun,
  startWorkflowDraftRun,
  waitForWorkflowDraftRunCompletion,
  type WorkflowDraftNodeRunRecord,
  type WorkflowRunEvent,
} from '../../app/workflowRunApi'
import type { CanvasNodeData } from '../types/canvas'
import type { Edge } from '../types/common'
import { NodeRunningStatus } from '../types/common'
import { WorkflowRunStatus, type WorkflowRunSummary } from '../types/run'
import {
  applyNodeLastRunsFromDraftRun,
  applyWorkflowDraftNodeRunsToCanvas,
  applyWorkflowRunEventToCanvas,
  clearWorkflowRunCanvasState,
} from '../utils/apply-run-event-to-canvas'
import {
  applyWorkflowRunEventsWithStagger,
  buildWorkflowRunEventsFromNodeRuns,
  createStaggeredWorkflowRunEventApplicator,
  replayWorkflowDraftRunEvents,
} from '../utils/replay-workflow-draft-run-events'

type CanvasSnapshot = {
  nodes: Array<Node<CanvasNodeData>>
  edges: Edge[]
}

export type WorkflowDraftRunUiCallbacks = {
  /** 节点开始执行：跟随锁定该节点 */
  onNodeStarted?: (nodeId: string) => void
  /** 节点执行结束（失败时由 hook 内再触发 onFocusNode） */
  onNodeFinished?: (nodeId: string, status: NodeRunningStatus) => void
  /** 打开对应节点 Panel（上次运行 tab）并视口居中 */
  onFocusNode?: (nodeId: string) => void
  /** 整图运行结束：聚焦失败节点或 End 输出节点 */
  onWorkflowFinished?: (
    run: WorkflowRunSummary,
    nodeRuns: WorkflowDraftNodeRunRecord[],
  ) => void
}

export type UseWorkflowDraftRunOptions = {
  appId?: string | null
  getCanvas: () => CanvasSnapshot
  setNodes: Dispatch<SetStateAction<Array<Node<CanvasNodeData>>>>
  setEdges: Dispatch<SetStateAction<Edge[]>>
  ui?: WorkflowDraftRunUiCallbacks
}

const mapEventNodeStatus = (status?: string): NodeRunningStatus => {
  if (!status) {
    return NodeRunningStatus.Succeeded
  }

  return status as NodeRunningStatus
}

export const useWorkflowDraftRun = ({
  appId,
  getCanvas,
  setNodes,
  setEdges,
  ui,
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

    if (event.type === 'node_started' && event.nodeId) {
      ui?.onNodeStarted?.(event.nodeId)
      ui?.onFocusNode?.(event.nodeId)
      return
    }

    if (event.type === 'node_finished' && event.nodeId) {
      const status = mapEventNodeStatus(event.status)
      ui?.onNodeFinished?.(event.nodeId, status)
      if (
        status === NodeRunningStatus.Failed
        || status === NodeRunningStatus.Exception
      ) {
        ui?.onFocusNode?.(event.nodeId)
      }
    }
  }, [applyCanvas, ui])

  const applyRunEvent = useMemo(
    () => createStaggeredWorkflowRunEventApplicator(applyEvent),
    [applyEvent],
  )

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

      if (isDeferredWorkflowDraftRun(run, nodeRuns)) {
        const finishedRun = await waitForWorkflowDraftRunCompletion({
          appId: trimmedAppId,
          runId: run.runId,
          applyEvent: applyRunEvent,
          onRunUpdate: setRunSummary,
          signal: abortController.signal,
        })

        if (abortController.signal.aborted) {
          return null
        }

        setRunSummary(finishedRun)
        ui?.onWorkflowFinished?.(finishedRun, [])
        return { run: finishedRun, nodeRuns: [] }
      }

      const replay = await replayWorkflowDraftRunEvents(
        trimmedAppId,
        run.runId,
        applyEvent,
        abortController.signal,
      )

      if (
        !replay.hasNodeLifecycleEvents
        && nodeRuns.length > 0
        && !abortController.signal.aborted
      ) {
        await applyWorkflowRunEventsWithStagger(
          buildWorkflowRunEventsFromNodeRuns(run.runId, nodeRuns),
          applyEvent,
          abortController.signal,
        )
      }

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
      ui?.onWorkflowFinished?.(run, nodeRuns)
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
  }, [appId, applyCanvas, applyEvent, applyRunEvent, ui])

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
    || runSummary?.status === WorkflowRunStatus.Queued
    || runSummary?.status === WorkflowRunStatus.Waiting

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
