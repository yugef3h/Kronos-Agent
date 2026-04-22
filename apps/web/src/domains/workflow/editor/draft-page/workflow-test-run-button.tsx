import { useCallback, type RefObject } from 'react'
import type { Node, ReactFlowInstance } from 'reactflow'
import type { WorkflowDSL } from '../../app/workflowAppStore'
import type { CanvasNodeData } from '../types/canvas'
import { useWorkflowCanvasInteraction } from '../context/workflow-canvas-interaction-context'
import { focusWorkflowNodeOnCanvas } from '../utils/focus-workflow-node-on-canvas'
import { resolveStartDraftTestRun } from '../utils/resolve-start-draft-test-run'
import type { ValidateRunnableDslResult } from '../utils/validate-runnable-dsl'

type ChecklistGroup = {
  nodeId: string
  title: string
  issues: Array<{ path: string; message: string }>
}

type WorkflowTestRunButtonProps = {
  appId?: string | null
  checklistGroups: ChecklistGroup[]
  runnableValidation: ValidateRunnableDslResult
  workflowDslPreview: WorkflowDSL
  triggerNode?: Node<CanvasNodeData>
  isDraftRunRunning: boolean
  reactFlowInstanceRef: RefObject<ReactFlowInstance | null>
  executeDraftRun: (dsl: WorkflowDSL, inputs?: Record<string, unknown>) => Promise<unknown>
}

export const WorkflowTestRunButton = ({
  appId,
  checklistGroups,
  runnableValidation,
  workflowDslPreview,
  triggerNode,
  isDraftRunRunning,
  reactFlowInstanceRef,
  executeDraftRun,
}: WorkflowTestRunButtonProps) => {
  const { openNodePanel, setNodeRunBlocker, clearNodeRunBlocker } = useWorkflowCanvasInteraction()

  const handleTestRunClick = useCallback(() => {
    if (isDraftRunRunning) {
      return
    }

    if (checklistGroups.length > 0) {
      const firstGroup = checklistGroups[0]
      setNodeRunBlocker(firstGroup.nodeId, firstGroup.issues.map((issue) => issue.message))
      openNodePanel(firstGroup.nodeId, 'settings')
      focusWorkflowNodeOnCanvas(reactFlowInstanceRef, firstGroup.nodeId)
      return
    }

    if (!runnableValidation.runnable) {
      const targetNodeId =
        runnableValidation.issues.find((issue) => issue.nodeId)?.nodeId ?? triggerNode?.id
      if (!targetNodeId) {
        return
      }

      setNodeRunBlocker(
        targetNodeId,
        runnableValidation.issues.map((issue) => issue.message),
      )
      openNodePanel(targetNodeId, 'settings')
      focusWorkflowNodeOnCanvas(reactFlowInstanceRef, targetNodeId)
      return
    }

    const triggerNodeId = triggerNode?.id
    if (!triggerNodeId) {
      return
    }

    const draftRun = resolveStartDraftTestRun({ appId, triggerNode })

    if (!draftRun.ready) {
      setNodeRunBlocker(triggerNodeId, draftRun.issues)
      openNodePanel(triggerNodeId, 'last-run')
      focusWorkflowNodeOnCanvas(reactFlowInstanceRef, triggerNodeId)
      return
    }

    clearNodeRunBlocker()
    void executeDraftRun(workflowDslPreview, draftRun.inputs)
  }, [
    appId,
    checklistGroups,
    clearNodeRunBlocker,
    executeDraftRun,
    isDraftRunRunning,
    openNodePanel,
    reactFlowInstanceRef,
    runnableValidation,
    setNodeRunBlocker,
    triggerNode,
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
            : '测试运行整图工作流'
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
