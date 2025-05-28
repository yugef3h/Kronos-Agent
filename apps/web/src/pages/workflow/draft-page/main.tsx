import React, { memo } from 'react';
import { ReactFlowProvider } from 'reactflow';
export const WorkflowMain = memo(({ children }: { children: React.ReactNode }) => {
  return <ReactFlowProvider>{children}</ReactFlowProvider>;
});
