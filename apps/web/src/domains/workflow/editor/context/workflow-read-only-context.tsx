import { createContext, useContext, type ReactNode } from 'react';

export const WORKFLOW_READONLY_EXAMPLE_LABEL = '只读实例';

type WorkflowReadOnlyContextValue = {
  isReadOnly: boolean;
};

const WorkflowReadOnlyContext = createContext<WorkflowReadOnlyContextValue>({ isReadOnly: false });

export const WorkflowReadOnlyProvider = ({
  isReadOnly,
  children,
}: {
  isReadOnly: boolean;
  children: ReactNode;
}) => (
  <WorkflowReadOnlyContext.Provider value={{ isReadOnly }}>{children}</WorkflowReadOnlyContext.Provider>
);

export const useWorkflowReadOnly = (): WorkflowReadOnlyContextValue => useContext(WorkflowReadOnlyContext);
