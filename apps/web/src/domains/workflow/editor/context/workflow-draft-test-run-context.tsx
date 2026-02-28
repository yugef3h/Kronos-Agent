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

type DraftTestRunInputsGetter = () => Record<string, unknown>

type WorkflowDraftTestRunContextValue = {
  isPending: boolean
  armPendingRun: () => void
  disarmPendingRun: () => void
  getDraftRunInputs: () => Record<string, unknown>
  registerDraftRunInputs: (getter: DraftTestRunInputsGetter | null) => void
}

const WorkflowDraftTestRunContext = createContext<WorkflowDraftTestRunContextValue | null>(null)

export const WorkflowDraftTestRunProvider = ({ children }: { children: ReactNode }) => {
  const [isPending, setIsPending] = useState(false)
  const getInputsRef = useRef<DraftTestRunInputsGetter | null>(null)

  const armPendingRun = useCallback(() => {
    setIsPending(true)
  }, [])

  const disarmPendingRun = useCallback(() => {
    setIsPending(false)
  }, [])

  const registerDraftRunInputs = useCallback((getter: DraftTestRunInputsGetter | null) => {
    getInputsRef.current = getter
  }, [])

  const getDraftRunInputs = useCallback(
    () => getInputsRef.current?.() ?? {},
    [],
  )

  const value = useMemo(
    () => ({
      isPending,
      armPendingRun,
      disarmPendingRun,
      getDraftRunInputs,
      registerDraftRunInputs,
    }),
    [armPendingRun, disarmPendingRun, getDraftRunInputs, isPending, registerDraftRunInputs],
  )

  return (
    <WorkflowDraftTestRunContext.Provider value={value}>
      {children}
    </WorkflowDraftTestRunContext.Provider>
  )
}

export const useWorkflowDraftTestRun = (): WorkflowDraftTestRunContextValue => {
  const context = useContext(WorkflowDraftTestRunContext)
  if (!context) {
    throw new Error('useWorkflowDraftTestRun must be used within WorkflowDraftTestRunProvider')
  }
  return context
}

export const useRegisterWorkflowDraftTestRunInputs = (getter: DraftTestRunInputsGetter) => {
  const { registerDraftRunInputs } = useWorkflowDraftTestRun()

  useEffect(() => {
    registerDraftRunInputs(getter)
    return () => registerDraftRunInputs(null)
  }, [getter, registerDraftRunInputs])
}
