import type { Node } from 'reactflow'
import type { CanvasNodeData } from '../types/canvas'
import { PANEL_DEBUG_START_VALUES_DEFAULT } from '../hooks/use-node-panel-debug-draft'
import {
  buildStartPanelDebugInputs,
  getStartPanelDebugConfigIssueMessages,
  mergeStartPanelDebugFormValues,
  validateStartPanelDebugFormValues,
  type StartPanelDebugFormValues,
} from '../panels/start-panel/debug-inputs'
import { normalizeStartNodeConfig } from '../panels/start-panel/schema'
import {
  mergePanelDebugDraft,
  readPersistedWorkflowEditorState,
} from './workflow-node-editor-state'

const CONFIG_ISSUE_PATH = '__config__'

export type ResolveStartDraftTestRunResult = {
  ready: boolean
  inputs: Record<string, unknown>
  issues: string[]
  debugValues: StartPanelDebugFormValues
}

export const resolveStartDraftTestRun = ({
  appId,
  triggerNode,
}: {
  appId?: string | null
  triggerNode?: Node<CanvasNodeData>
}): ResolveStartDraftTestRunResult => {
  if (!triggerNode) {
    return {
      ready: false,
      inputs: {},
      issues: ['缺少开始节点。'],
      debugValues: PANEL_DEBUG_START_VALUES_DEFAULT,
    }
  }

  const config = normalizeStartNodeConfig(triggerNode.data.inputs)
  const persistedDraft = appId
    ? readPersistedWorkflowEditorState(appId)?.nodes[triggerNode.id]?.panelDebugDraft
    : undefined
  const storedDraft = mergePanelDebugDraft(
    mergePanelDebugDraft(PANEL_DEBUG_START_VALUES_DEFAULT, persistedDraft),
    triggerNode.data._panelDebugDraft,
  ) as StartPanelDebugFormValues
  const debugValues = mergeStartPanelDebugFormValues(config, storedDraft)
  const validationIssues = validateStartPanelDebugFormValues(config, debugValues)
  const issues = [
    ...getStartPanelDebugConfigIssueMessages(validationIssues),
    ...validationIssues
      .filter((issue) => issue.path !== CONFIG_ISSUE_PATH)
      .map((issue) => issue.message),
  ]

  return {
    ready: issues.length === 0,
    inputs: buildStartPanelDebugInputs(config, debugValues),
    issues,
    debugValues,
  }
}
