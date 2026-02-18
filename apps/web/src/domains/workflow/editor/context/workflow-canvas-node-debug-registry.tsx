import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { PanelNodeDebugRegistration } from '../base/panel-node-debug-context'

type RegistryMap = Record<string, PanelNodeDebugRegistration>

type WorkflowCanvasNodeDebugRegistryValue = {
  getRegistration: (nodeId: string) => PanelNodeDebugRegistration | null
  register: (nodeId: string, registration: PanelNodeDebugRegistration | null) => void
}

const WorkflowCanvasNodeDebugRegistryContext =
  createContext<WorkflowCanvasNodeDebugRegistryValue | null>(null)

export const WorkflowCanvasNodeDebugRegistryProvider = ({ children }: { children: ReactNode }) => {
  const [registry, setRegistry] = useState<RegistryMap>({})

  const register = useCallback((nodeId: string, registration: PanelNodeDebugRegistration | null) => {
    setRegistry((current) => {
      if (!registration) {
        if (!(nodeId in current)) {
          return current
        }
        const next = { ...current }
        delete next[nodeId]
        return next
      }

      return { ...current, [nodeId]: registration }
    })
  }, [])

  const getRegistration = useCallback(
    (nodeId: string) => registry[nodeId] ?? null,
    [registry],
  )

  const value = useMemo(
    () => ({ getRegistration, register }),
    [getRegistration, register],
  )

  return (
    <WorkflowCanvasNodeDebugRegistryContext.Provider value={value}>
      {children}
    </WorkflowCanvasNodeDebugRegistryContext.Provider>
  )
}

export const useWorkflowCanvasNodeDebugRegistry = (): WorkflowCanvasNodeDebugRegistryValue => {
  const context = useContext(WorkflowCanvasNodeDebugRegistryContext)
  if (!context) {
    throw new Error('useWorkflowCanvasNodeDebugRegistry must be used within WorkflowCanvasNodeDebugRegistryProvider')
  }
  return context
}

/** Panel 挂载时按 nodeId 注册；画布节点「运行」优先走 Panel 内已填写的调试参数 */
export const useRegisterCanvasNodeDebug = (
  nodeId: string,
  registration: PanelNodeDebugRegistration | null,
): void => {
  const { register } = useWorkflowCanvasNodeDebugRegistry()
  const registrationRef = useRef(registration)
  registrationRef.current = registration

  useEffect(() => {
    register(nodeId, registrationRef.current)
    return () => register(nodeId, null)
  }, [nodeId, register, registration])
}
