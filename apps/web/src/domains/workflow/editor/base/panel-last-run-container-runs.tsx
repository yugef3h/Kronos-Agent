import { useState } from 'react'
import { PanelCard } from './panel-form'
import type { NodeLastRunSnapshot } from '../types/run'

type ContainerRound = {
  iterationIndex?: number
  status?: string
  outputs?: Record<string, unknown>
  nodeRuns?: NodeLastRunSnapshot[]
}

const readContainerRounds = (lastRun: NodeLastRunSnapshot): ContainerRound[] => {
  const outputs = lastRun.outputs
  if (!outputs || typeof outputs !== 'object') {
    return []
  }

  const rounds = (outputs as { rounds?: ContainerRound[] }).rounds
  if (Array.isArray(rounds) && rounds.length > 0) {
    return rounds
  }

  const nodeRuns = (outputs as { nodeRuns?: NodeLastRunSnapshot[] }).nodeRuns
  if (Array.isArray(nodeRuns) && nodeRuns.length > 0) {
    return [{
      iterationIndex: lastRun.iterationIndex,
      status: lastRun.status,
      nodeRuns,
    }]
  }

  return []
}

export const PanelLastRunContainerRuns = ({
  lastRun,
  emptyLabel,
}: {
  lastRun?: NodeLastRunSnapshot | null
  emptyLabel: string
}) => {
  const rounds = lastRun ? readContainerRounds(lastRun) : []
  const [openIndex, setOpenIndex] = useState(0)

  if (!lastRun) {
    return (
      <PanelCard className="space-y-1.5 bg-slate-50/70 p-3">
        <p className="text-[12px] font-semibold text-slate-800">暂无运行轮次</p>
        <p className="text-[11px] leading-5 text-slate-500">{emptyLabel}</p>
      </PanelCard>
    )
  }

  if (!rounds.length) {
    return (
      <PanelCard className="space-y-1.5 bg-slate-50/70 p-3">
        <p className="text-[12px] font-semibold text-slate-800">运行摘要</p>
        <p className="text-[11px] leading-5 text-slate-500">
          状态 {lastRun.status}
          {lastRun.iterationIndex !== undefined ? ` · 迭代 #${lastRun.iterationIndex + 1}` : ''}
        </p>
        <p className="text-[11px] text-slate-400">{emptyLabel}</p>
      </PanelCard>
    )
  }

  return (
    <div className="space-y-2">
      {rounds.map((round, index) => {
        const isOpen = openIndex === index
        const title = round.iterationIndex !== undefined
          ? `第 ${round.iterationIndex + 1} 轮`
          : `第 ${index + 1} 轮`

        return (
          <PanelCard key={`${title}-${index}`} className="overflow-hidden bg-slate-50/70 p-0 shadow-none">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? -1 : index)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] font-semibold text-slate-800"
            >
              <span>{title}</span>
              <span className="text-[11px] font-normal text-slate-500">
                {round.status ?? 'succeeded'}
                {' '}
                {isOpen ? '▾' : '▸'}
              </span>
            </button>
            {isOpen ? (
              <div className="space-y-1 border-t border-slate-200 px-3 py-2">
                {(round.nodeRuns ?? []).length ? (
                  round.nodeRuns?.map((nodeRun) => (
                    <div
                      key={`${nodeRun.nodeId}-${nodeRun.startedAt ?? index}`}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700"
                    >
                      <p className="font-semibold">{nodeRun.nodeId}</p>
                      <p className="text-slate-500">{nodeRun.status}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-slate-500">本轮暂无子节点运行记录。</p>
                )}
              </div>
            ) : null}
          </PanelCard>
        )
      })}
    </div>
  )
}
