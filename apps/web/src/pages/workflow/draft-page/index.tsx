import { WorkflowMain } from "./main"
import { WorkflowChildren } from "./workflow-children"

export const WorkflowDraftPage = () => {
  return (
    <WorkflowMain>
      <WorkflowChildren />
    </WorkflowMain>
  )
}