import { useCallback, type RefObject } from 'react'
import type { ReactFlowInstance } from 'reactflow'
import type { WorkflowDSL } from '../../app/workflowAppStore'
import { useWorkflowCanvasInteraction } from '../context/workflow-canvas-interaction-context'
import { useWorkflowDraftTestRun } from '../context/workflow-draft-test-run-context'
import type { ValidateRunnableDslResult } from '../utils/validate-runnable-dsl'

type ChecklistGroup = {
  nodeId: string
  title: string
  issues: Array<{ path: string; message: string }>
}

type WorkflowTestRunButtonProps = {
  checklistGroups: ChecklistGroup[]
  runnableValidation: ValidateRunnableDslResult
  workflowDslPreview: WorkflowDSL
  triggerNodeId?: string
  selectedNodeId?: string
  isDraftRunRunning: boolean
  reactFlowInstanceRef: RefObject<ReactFlowInstance | null>
  executeDraftRun: (dsl: WorkflowDSL, inputs?: Record<string, unknown>) => Promise<unknown>
}

const focusNodeOnCanvas = (
  reactFlowInstanceRef: RefObject<ReactFlowInstance | null>,
  nodeId: string,
) => {
  requestAnimationFrame(() => {
    const instance = reactFlowInstanceRef.current
    const targetNode = instance?.getNode(nodeId)
    if (!instance || !targetNode) {
      return
    }

    instance.fitView({ nodes: [targetNode], padding: 0.35, duration: 350, maxZoom: 1 })
  })
}

export const WorkflowTestRunButton = ({
  checklistGroups,
  runnableValidation,
  workflowDslPreview,
  triggerNodeId,
  selectedNodeId,
  isDraftRunRunning,
  reactFlowInstanceRef,
  executeDraftRun,
}: WorkflowTestRunButtonProps) => {
  const { openNodePanel, setNodeRunBlocker, clearNodeRunBlocker } = useWorkflowCanvasInteraction()
  const { isPending, armPendingRun, disarmPendingRun, getDraftRunInputs } = useWorkflowDraftTestRun()

  const handleTestRunClick = useCallback(() => {
    if (isDraftRunRunning) {
      return
    }

    if (checklistGroups.length > 0) {
      disarmPendingRun()
      const firstGroup = checklistGroups[0]
      setNodeRunBlocker(firstGroup.nodeId, firstGroup.issues.map((issue) => issue.message))
      openNodePanel(firstGroup.nodeId, 'settings')
      focusNodeOnCanvas(reactFlowInstanceRef, firstGroup.nodeId)
      return
    }

    if (!runnableValidation.runnable) {
      disarmPendingRun()
      const targetNodeId =
        runnableValidation.issues.find((issue) => issue.nodeId)?.nodeId ?? triggerNodeId
      if (!targetNodeId) {
        return
      }

      setNodeRunBlocker(
        targetNodeId,
        runnableValidation.issues.map((issue) => issue.message),
      )
      openNodePanel(targetNodeId, 'settings')
      focusNodeOnCanvas(reactFlowInstanceRef, targetNodeId)
      return
    }

    if (!triggerNodeId) {
      return
    }

    if (isPending && selectedNodeId === triggerNodeId) {
      disarmPendingRun()
      clearNodeRunBlocker()
      void executeDraftRun(workflowDslPreview, getDraftRunInputs())
      return
    }

    disarmPendingRun()
    clearNodeRunBlocker()
    armPendingRun()
    openNodePanel(triggerNodeId, 'last-run')
    focusNodeOnCanvas(reactFlowInstanceRef, triggerNodeId)
  }, [
    armPendingRun,
    checklistGroups,
    clearNodeRunBlocker,
    disarmPendingRun,
    executeDraftRun,
    getDraftRunInputs,
    isDraftRunRunning,
    isPending,
    openNodePanel,
    reactFlowInstanceRef,
    runnableValidation,
    selectedNodeId,
    setNodeRunBlocker,
    triggerNodeId,
    workflowDslPreview,
  ])

  const checklistCount = checklistGroups.length

  return (
    <button
      type="button"
      className="inline-flex h-8 items-center gap-1.5 rounded-[14px] bg-[linear-gradient(180deg,#ffffff_0%,#eef5ff_100%)] px-3 text-[13px] font-semibold text-blue-700 transition hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={isDraftRunRunning}
      title={
        checklistCount > 0
          ? '存在待修复项，点击打开对应节点 Panel'
          : !runnableValidation.runnable
            ? '工作流结构不完整，点击打开对应节点 Panel'
            : isPending && selectedNodeId === triggerNodeId
              ? '再次点击开始整图测试运行'
              : '打开开始节点填写测试输入'
      }
      onClick={handleTestRunClick}
    >
      <svg
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="currentColor"
        className="remixicon size-4"
      >
        <path d="M8 18.3915V5.60846L18.2264 12L8 18.3915ZM6 3.80421V20.1957C6 20.9812 6.86395 21.46 7.53 21.0437L20.6432 12.848C21.2699 12.4563 21.2699 11.5436 20.6432 11.152L7.53 2.95621C6.86395 2.53993 6 3.01878 6 3.80421Z" />
      </svg>
      <span>测试运行</span>
    </button>
  )
}
