import type { NodeLastRunSnapshot } from '../types/run'

export type WorkflowNodeEditorState = {
  panelDebugDraft?: Record<string, unknown>
  lastRun?: NodeLastRunSnapshot
}

export type PersistedWorkflowEditorState = {
  nodes: Record<string, WorkflowNodeEditorState>
}

const STORAGE_KEY_PREFIX = 'kronos_workflow_editor_state_v1_'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const mergePanelDebugDraft = <T extends Record<string, unknown>>(
  defaults: T,
  stored?: Record<string, unknown>,
): T => {
  if (!stored || !isRecord(stored)) {
    return defaults
  }

  return { ...defaults, ...stored } as T
}

export const readEditorStateFromDslNodeData = (
  data: Record<string, unknown>,
): WorkflowNodeEditorState | undefined => {
  const editor = data.editor
  if (!isRecord(editor)) {
    return undefined
  }

  const panelDebugDraft = isRecord(editor.panelDebugDraft)
    ? editor.panelDebugDraft
    : undefined

  const lastRun = isRecord(editor.lastRun)
    ? (editor.lastRun as NodeLastRunSnapshot)
    : undefined

  if (!panelDebugDraft && !lastRun) {
    return undefined
  }

  return {
    ...(panelDebugDraft ? { panelDebugDraft } : {}),
    ...(lastRun ? { lastRun } : {}),
  }
}

export const serializeEditorStateForDsl = (
  panelDebugDraft?: Record<string, unknown>,
  lastRun?: NodeLastRunSnapshot,
): WorkflowNodeEditorState | undefined => {
  void lastRun

  if (!panelDebugDraft) {
    return undefined
  }

  return { panelDebugDraft }
}

export const readPersistedWorkflowEditorState = (
  appId: string,
): PersistedWorkflowEditorState | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${appId}`)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed) || !isRecord(parsed.nodes)) {
      return null
    }

    return { nodes: parsed.nodes as Record<string, WorkflowNodeEditorState> }
  } catch {
    return null
  }
}

export const writePersistedWorkflowEditorState = (
  appId: string,
  state: PersistedWorkflowEditorState,
): void => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (!Object.keys(state.nodes).length) {
      window.localStorage.removeItem(`${STORAGE_KEY_PREFIX}${appId}`)
      return
    }

    window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${appId}`, JSON.stringify(state))
  } catch {
    // ignore quota errors
  }
}

export const collectEditorStateFromCanvasNodes = (
  nodes: Array<{ id: string; data: { _panelDebugDraft?: Record<string, unknown>; _lastRun?: NodeLastRunSnapshot } }>,
): PersistedWorkflowEditorState => {
  const result: PersistedWorkflowEditorState['nodes'] = {}

  for (const node of nodes) {
    const serialized = serializeEditorStateForDsl(node.data._panelDebugDraft)
    if (serialized) {
      result[node.id] = serialized
    }
  }

  return { nodes: result }
}

export const mergePersistedEditorStateIntoNodes = <T extends { id: string; data: Record<string, unknown> }>(
  nodes: T[],
  persisted: PersistedWorkflowEditorState | null,
): T[] => {
  if (!persisted?.nodes) {
    return nodes
  }

  return nodes.map((node) => {
    const saved = persisted.nodes[node.id]
    if (!saved) {
      return node
    }

    return {
      ...node,
      data: {
        ...node.data,
        ...(saved.panelDebugDraft ? { _panelDebugDraft: saved.panelDebugDraft } : {}),
        ...(saved.lastRun ? { _lastRun: saved.lastRun } : {}),
      },
    }
  })
}
