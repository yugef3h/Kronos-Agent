import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { PanelDefaultTab } from '../base/panel-form'

export type WorkflowPanelFocus = {
  nodeId: string
  tab: PanelDefaultTab
}

export type WorkflowNodeRunBlocker = {
  nodeId: string
  messages: string[]
}

type WorkflowCanvasInteractionContextValue = {
  isCanvasLocked: boolean
  isDraftRunActive: boolean
  selectNodeById: (nodeId?: string) => void
  panelFocus: WorkflowPanelFocus | null
  focusPanelTabForNode: (nodeId: string, tab?: PanelDefaultTab) => void
  clearPanelFocus: () => void
  nodeRunBlocker: WorkflowNodeRunBlocker | null
  setNodeRunBlocker: (nodeId: string, messages: string[]) => void
  clearNodeRunBlocker: () => void
}

const WorkflowCanvasInteractionContext = createContext<WorkflowCanvasInteractionContextValue | null>(null)

export const WorkflowCanvasInteractionProvider = ({
  isCanvasLocked,
  isDraftRunActive,
  selectNodeById,
  children,
}: {
  isCanvasLocked: boolean
  isDraftRunActive: boolean
  selectNodeById: (nodeId?: string) => void
  children: ReactNode
}) => {
  const [panelFocus, setPanelFocus] = useState<WorkflowPanelFocus | null>(null)
  const [nodeRunBlocker, setNodeRunBlockerState] = useState<WorkflowNodeRunBlocker | null>(null)

  const focusPanelTabForNode = useCallback((nodeId: string, tab: PanelDefaultTab = 'last-run') => {
    setPanelFocus({ nodeId, tab })
  }, [])

  const clearPanelFocus = useCallback(() => {
    setPanelFocus(null)
  }, [])

  const setNodeRunBlocker = useCallback((nodeId: string, messages: string[]) => {
    setNodeRunBlockerState({ nodeId, messages })
  }, [])

  const clearNodeRunBlocker = useCallback(() => {
    setNodeRunBlockerState(null)
  }, [])

  const value = useMemo(
    () => ({
      isCanvasLocked,
      isDraftRunActive,
      selectNodeById,
      panelFocus,
      focusPanelTabForNode,
      clearPanelFocus,
      nodeRunBlocker,
      setNodeRunBlocker,
      clearNodeRunBlocker,
    }),
    [
      clearNodeRunBlocker,
      clearPanelFocus,
      focusPanelTabForNode,
      isCanvasLocked,
      isDraftRunActive,
      nodeRunBlocker,
      panelFocus,
      selectNodeById,
      setNodeRunBlocker,
    ],
  )

  return (
    <WorkflowCanvasInteractionContext.Provider value={value}>
      {children}
    </WorkflowCanvasInteractionContext.Provider>
  )
}

export const useWorkflowCanvasInteraction = (): WorkflowCanvasInteractionContextValue => {
  const context = useContext(WorkflowCanvasInteractionContext)
  if (!context) {
    throw new Error('useWorkflowCanvasInteraction must be used within WorkflowCanvasInteractionProvider')
  }
  return context
}
