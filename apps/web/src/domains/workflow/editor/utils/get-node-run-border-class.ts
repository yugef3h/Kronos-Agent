import { NodeRunningStatus } from '../types/common'

export const getNodeRunBorderClass = (runStatus?: NodeRunningStatus): string | null => {
  if (runStatus === NodeRunningStatus.Running) {
    return '!border-dashed !border-blue-500'
  }

  return null
}
