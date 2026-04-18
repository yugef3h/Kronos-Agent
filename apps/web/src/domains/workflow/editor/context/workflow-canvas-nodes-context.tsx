import {
  createContext,
  useContext,
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import type { Node } from 'reactflow'
import type { CanvasNodeData } from '../types/canvas'
import type { Edge } from '../types/common'

type WorkflowCanvasNodesContextValue = {
  nodes: Array<Node<CanvasNodeData>>
  edges: Edge[]
  setNodes: Dispatch<SetStateAction<Array<Node<CanvasNodeData>>>>
  setEdges: Dispatch<SetStateAction<Edge[]>>
  patchNodeData: (nodeId: string, patch: Partial<CanvasNodeData>) => void
}

const WorkflowCanvasNodesContext = createContext<WorkflowCanvasNodesContextValue | null>(null)

export const WorkflowCanvasNodesProvider = ({
  nodes,
  edges,
  setNodes,
  setEdges,
  patchNodeData,
  children,
}: WorkflowCanvasNodesContextValue & {
  children: ReactNode
}) => {
  const value = useMemo(
    () => ({
      nodes,
      edges,
      setNodes,
      setEdges,
      patchNodeData,
    }),
    [edges, nodes, patchNodeData, setEdges, setNodes],
  )

  return (
    <WorkflowCanvasNodesContext.Provider value={value}>
      {children}
    </WorkflowCanvasNodesContext.Provider>
  )
}

export const useWorkflowCanvasNodes = (): WorkflowCanvasNodesContextValue => {
  const context = useContext(WorkflowCanvasNodesContext)
  if (!context) {
    throw new Error('useWorkflowCanvasNodes must be used within WorkflowCanvasNodesProvider')
  }
  return context
}
