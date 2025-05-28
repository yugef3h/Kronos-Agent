import { Panel as NodePanel } from "../compts/custom-node";
import { useShallow } from 'zustand/react/shallow';
import React, { memo, useCallback, useEffect, useRef } from "react";
import { useStore as useReactflow } from 'reactflow'
import { cn } from "../utils/classnames";

/**
 * Reference MDN standard implementation：https://developer.mozilla.org/zh-CN/docs/Web/API/ResizeObserverEntry/borderBoxSize
 */
const getEntryWidth = (entry: ResizeObserverEntry, element: HTMLElement): number => {
  if (entry.borderBoxSize?.length > 0)
    return entry.borderBoxSize[0].inlineSize

  if (entry.contentRect.width > 0)
    return entry.contentRect.width

  return element.getBoundingClientRect().width
}

export const useResizeObserver = (
  callback: (width: number) => void,
) => {
  const elementRef = useRef<HTMLDivElement>(null)

  const stableCallback = useCallback(callback, [callback])

  useEffect(() => {
    const element = elementRef.current
    if (!element)
      return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = getEntryWidth(entry, element)
        stableCallback(width)
      }
    })

    resizeObserver.observe(element)

    const initialWidth = element.getBoundingClientRect().width
    stableCallback(initialWidth)

    return () => {
      resizeObserver.disconnect()
    }
  }, [stableCallback])
  return elementRef
}

const Panel = () => {
  const selectedNode = useReactflow(useShallow((s) => {
    const nodes = s.getNodes()
    const currentNode = nodes.find(node => node.data.selected)

    if (currentNode) {
      return {
        id: currentNode.id,
        type: currentNode.type,
        data: currentNode.data,
      }
    }
  }))

  if (!selectedNode)
    return null

  const panelTitle = typeof selectedNode.data.title === 'string'
    ? selectedNode.data.title
    : '节点配置'


  return (
    <div
      tabIndex={-1}
      className={cn('pointer-events-none absolute inset-y-4 right-4 z-10 flex items-start outline-none')}
    >
      <div className="pointer-events-auto flex h-full w-[320px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_50px_-28px_rgba(15,23,42,0.45)]">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Panel</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{panelTitle}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <NodePanel {...selectedNode} />
        </div>
      </div>
    </div>
  )
}

export default memo(Panel)