import { useCallback, useMemo } from 'react'
import type { CanvasNodeData } from '../types/canvas'
import { buildCanvasNodeDebugRunOptions, canQuickRunCanvasNode } from '../utils/build-canvas-node-debug-options'
import { useNodeDebugRun } from './use-node-debug-run'

export type UseCanvasNodeQuickRunOptions = {
  appId?: string | null
  nodeId: string
  data: CanvasNodeData
}

/** 画布节点 ▶：始终用默认 debug 载荷，不受 Panel「调试」disabled / 表单校验影响 */
export const useCanvasNodeQuickRun = ({ appId, nodeId, data }: UseCanvasNodeQuickRunOptions) => {
  const fallbackOptions = useMemo(
    () => buildCanvasNodeDebugRunOptions(appId, nodeId, data),
    [appId, data, nodeId],
  )

  const fallback = useNodeDebugRun(
    fallbackOptions ?? {
      appId,
      nodeId,
      nodeKind: data.kind,
    },
  )

  const canRun = canQuickRunCanvasNode(data.kind)

  const run = useCallback(async () => {
    if (!fallbackOptions) {
      return
    }

    await fallback.runDebug()
  }, [fallback, fallbackOptions])

  return {
    run,
    isRunning: fallback.isRunning,
    canRun,
    error: fallback.error,
    clearError: fallback.clearError,
  }
}
