import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRegisterCanvasNodeDebug } from '../context/workflow-canvas-node-debug-registry'

export type PanelNodeDebugRegistration = {
  runDebug: () => void | Promise<void>
  isRunning: boolean
  disabled?: boolean
}

type PanelNodeDebugContextValue = {
  registration: PanelNodeDebugRegistration | null
  setRegistration: (registration: PanelNodeDebugRegistration | null) => void
}

const PanelNodeDebugContext = createContext<PanelNodeDebugContextValue | null>(null)

export const PanelNodeDebugProvider = ({ children }: { children: React.ReactNode }) => {
  const [registration, setRegistration] = useState<PanelNodeDebugRegistration | null>(null)

  const value = useMemo(
    () => ({ registration, setRegistration }),
    [registration],
  )

  return (
    <PanelNodeDebugContext.Provider value={value}>
      {children}
    </PanelNodeDebugContext.Provider>
  )
}

export const useRegisterPanelNodeDebug = (
  nodeId: string,
  registration: PanelNodeDebugRegistration | null,
): void => {
  const context = useContext(PanelNodeDebugContext)
  const setRegistration = context?.setRegistration
  const registrationRef = useRef(registration)
  registrationRef.current = registration

  useRegisterCanvasNodeDebug(nodeId, registration)

  useEffect(() => {
    if (!setRegistration) {
      return undefined
    }

    const syncRegistration = () => {
      const current = registrationRef.current
      if (!current) {
        setRegistration(null)
        return
      }

      setRegistration({
        runDebug: () => {
          void registrationRef.current?.runDebug()
        },
        isRunning: current.isRunning,
        disabled: current.disabled,
      })
    }

    syncRegistration()
    return () => setRegistration(null)
  }, [
    nodeId,
    registration?.disabled,
    registration?.isRunning,
    setRegistration,
  ])
}

export const usePanelNodeDebugToolbar = (): {
  canShow: boolean
  runDebug: () => void
  isRunning: boolean
  disabled: boolean
} => {
  const context = useContext(PanelNodeDebugContext)
  const registration = context?.registration

  const runDebug = useCallback(() => {
    void registration?.runDebug()
  }, [registration])

  return {
    canShow: Boolean(registration),
    runDebug,
    isRunning: registration?.isRunning ?? false,
    disabled: registration?.disabled ?? false,
  }
}
