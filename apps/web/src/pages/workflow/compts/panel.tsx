import { Panel as NodePanel } from "../compts/custom-node";
import type { PanelProps as NodePanelProps } from '../compts/custom-node'
import React, { memo, useCallback, useEffect, useRef } from "react";
import { cn } from "../utils/classnames";
import { PANEL_Z_INDEX } from '../layout-constants'

type PanelProps = {
  selectedNode?: NodePanelProps
  onClose: () => void
}

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

const Panel = ({ selectedNode, onClose }: PanelProps) => {
  if (!selectedNode)
    return null

  const stopPanelEvent = (event: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const panelTitle = typeof selectedNode.data.title === 'string'
    ? selectedNode.data.title
    : '节点配置'


  return (
    <div
      tabIndex={-1}
      className={cn('pointer-events-none absolute inset-y-4 right-4 z-10 flex items-start outline-none')}
      style={{ zIndex: PANEL_Z_INDEX }}
    >
      <div
        className="pointer-events-auto flex h-full w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_50px_-28px_rgba(15,23,42,0.45)]"
        onMouseDown={stopPanelEvent}
        onClick={stopPanelEvent}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="mt-1 truncate text-sm font-semibold text-slate-900">{panelTitle}</p>
          </div>
          <button
            type="button"
            onMouseDown={stopPanelEvent}
            onClick={(event) => {
              stopPanelEvent(event)
              onClose()
            }}
            className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            关闭
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <NodePanel {...selectedNode} />
        </div>
      </div>
    </div>
  )
}

export default memo(Panel)