import { useCallback, useEffect, useRef, useState } from 'react'
import { useWorkflowCanvasNodes } from '../context/workflow-canvas-nodes-context'
import {
  mergePanelDebugDraft,
  readPersistedWorkflowEditorState,
  writePersistedWorkflowEditorState,
} from '../utils/workflow-node-editor-state'
import { useWorkflowAppId } from './use-workflow-app-id'

/** Persists「上次运行」tab form values on canvas node data (survives panel close). */
export const useNodePanelDebugDraft = <T extends Record<string, unknown>>(
  nodeId: string,
  stored: Record<string, unknown> | undefined,
  defaults: T,
): [T, (updater: T | ((previous: T) => T)) => void] => {
  const appId = useWorkflowAppId()
  const { patchNodeData } = useWorkflowCanvasNodes()

  const [value, setValueLocal] = useState<T>(() => mergePanelDebugDraft(defaults, stored))
  const hydrationNodeIdRef = useRef(nodeId)

  useEffect(() => {
    if (hydrationNodeIdRef.current === nodeId) {
      return
    }

    hydrationNodeIdRef.current = nodeId
    setValueLocal(mergePanelDebugDraft(defaults, stored))
  }, [defaults, nodeId, stored])

  const setValue = useCallback(
    (updater: T | ((previous: T) => T)) => {
      setValueLocal((previous) => {
        const next =
          typeof updater === 'function'
            ? (updater as (prev: T) => T)(previous)
            : updater

        patchNodeData(nodeId, { _panelDebugDraft: next })

        if (appId) {
          const previous = readPersistedWorkflowEditorState(appId)
          writePersistedWorkflowEditorState(appId, {
            nodes: {
              ...(previous?.nodes ?? {}),
              [nodeId]: { panelDebugDraft: next },
            },
          })
        }

        return next
      })
    },
    [appId, nodeId, patchNodeData],
  )

  return [value, setValue]
}

export const PANEL_DEBUG_CONTEXT_JSON_DEFAULT: { contextJson: string } = {
  contextJson: '{}',
}

export const PANEL_DEBUG_QUERY_DEFAULT: { query: string } = {
  query: '',
}

export const PANEL_DEBUG_LLM_VALUES_DEFAULT: Record<string, string> = {}

export const PANEL_DEBUG_START_VALUES_DEFAULT: Record<string, string> = {
  query: '',
}

