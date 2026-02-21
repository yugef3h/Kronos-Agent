import { createContext, useContext, type ReactNode } from 'react'

type WorkflowCanvasInteractionContextValue = {
  /** 禁止改结构：拖拽、连线等（草稿测试运行中或只读示例） */
  isCanvasLocked: boolean
  /** 整图测试运行中（单节点运行仍可点，除非与此合并策略冲突） */
  isDraftRunActive: boolean
}

const WorkflowCanvasInteractionContext = createContext<WorkflowCanvasInteractionContextValue>({
  isCanvasLocked: false,
  isDraftRunActive: false,
})

export const WorkflowCanvasInteractionProvider = ({
  isCanvasLocked,
  isDraftRunActive,
  children,
}: {
  isCanvasLocked: boolean
  isDraftRunActive: boolean
  children: ReactNode
}) => (
  <WorkflowCanvasInteractionContext.Provider value={{ isCanvasLocked, isDraftRunActive }}>
    {children}
  </WorkflowCanvasInteractionContext.Provider>
)

export const useWorkflowCanvasInteraction = (): WorkflowCanvasInteractionContextValue =>
  useContext(WorkflowCanvasInteractionContext)
