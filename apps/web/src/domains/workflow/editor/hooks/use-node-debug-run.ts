import { useCallback, useState } from 'react'
import { useReactFlow } from 'reactflow'
import {
  debugWorkflowNode,
  type NodeDebugRequest,
} from '../../app/workflowNodeDebugApi'
import type { CanvasNodeData, WorkflowCanvasNodeKind } from '../types/canvas'
import { NodeRunningStatus } from '../types/common'
import type { Edge } from '../types/common'
import { isTerminalNodeRunStatus } from '../types/run'
import { resolveNodeDebugBlockKind } from '../utils/node-debug-kind'
import { toNodeLastRunSnapshot } from '../utils/to-node-last-run-snapshot'

export type UseNodeDebugRunOptions = {
  appId?: string | null
  nodeId: string
  nodeKind: WorkflowCanvasNodeKind
  nodeInputs?: Record<string, unknown>
  nodeOutputs?: Record<string, unknown>
  debugInputs?: Record<string, unknown>
  contextVariables?: Record<string, unknown>
}

const buildNodeDebugRequest = (options: UseNodeDebugRunOptions): NodeDebugRequest | null => {
  const appId = options.appId?.trim()
  if (!appId) {
    return null
  }

  const blockKind = resolveNodeDebugBlockKind(options.nodeKind)
  if (!blockKind) {
    return null
  }

  return {
    appId,
    node: {
      id: options.nodeId,
      type: blockKind,
      ...(options.nodeInputs ? { inputs: options.nodeInputs } : {}),
      ...(options.nodeOutputs ? { outputs: options.nodeOutputs } : {}),
    },
    ...(options.debugInputs ? { inputs: options.debugInputs } : {}),
    ...(options.contextVariables
      ? { context: { variables: options.contextVariables } }
      : {}),
  }
}

export const useNodeDebugRun = ({
  appId,
  nodeId,
  nodeKind,
  nodeInputs,
  nodeOutputs,
  debugInputs,
  contextVariables,
}: UseNodeDebugRunOptions) => {
  const { setNodes } = useReactFlow<CanvasNodeData, Edge>()
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runDebug = useCallback(async () => {
    const request = buildNodeDebugRequest({
      appId,
      nodeId,
      nodeKind,
      nodeInputs,
      nodeOutputs,
      debugInputs,
      contextVariables,
    })
    if (!request) {
      const blockKind = resolveNodeDebugBlockKind(nodeKind)
      setError(
        !appId?.trim()
          ? '缺少工作流 appId，无法调试。'
          : blockKind
            ? '无法构建调试请求。'
            : '该节点类型暂不支持单节点调试。',
      )
      return null
    }

    setIsRunning(true)
    setError(null)

    setNodes((nodes) => nodes.map((node) => {
      if (node.id !== nodeId) {
        return node
      }

      return {
        ...node,
        data: {
          ...node.data,
          _runStatus: NodeRunningStatus.Running,
        },
      }
    }))

    try {
      const response = await debugWorkflowNode(request)
      const lastRun = toNodeLastRunSnapshot(response)
      const terminalStatus = lastRun.status

      setNodes((nodes) => nodes.map((node) => {
        if (node.id !== nodeId) {
          return node
        }

        return {
          ...node,
          data: {
            ...node.data,
            _lastRun: lastRun,
            _runStatus: isTerminalNodeRunStatus(terminalStatus)
              ? terminalStatus
              : NodeRunningStatus.Succeeded,
          },
        }
      }))

      return lastRun
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '单节点调试失败'
      setError(message)

      setNodes((nodes) => nodes.map((node) => {
        if (node.id !== nodeId) {
          return node
        }

        return {
          ...node,
          data: {
            ...node.data,
            _runStatus: NodeRunningStatus.Failed,
          },
        }
      }))

      return null
    } finally {
      setIsRunning(false)
    }
  }, [
    appId,
    nodeId,
    nodeKind,
    nodeInputs,
    nodeOutputs,
    debugInputs,
    contextVariables,
    setNodes,
  ])

  return {
    runDebug,
    isRunning,
    error,
    clearError: () => setError(null),
  }
}
