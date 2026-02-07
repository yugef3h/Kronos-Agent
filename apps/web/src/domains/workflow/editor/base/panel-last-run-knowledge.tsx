import { PanelCard, PanelToken } from './panel-form'
import type { NodeLastRunSnapshot } from '../types/run'

type KnowledgeItem = {
  chunk_id: string
  dataset_name: string
  document_name: string
  chunk_index: number
  text: string
  score: number
  search_method: string
  matched_terms: string[]
}

type KnowledgeOutputs = {
  items?: KnowledgeItem[]
  diagnostics?: {
    dataset_count: number
    total_chunk_count: number
    filtered_chunk_count: number
  }
}

export const PanelLastRunKnowledgeDetails = ({ lastRun }: { lastRun: NodeLastRunSnapshot }) => {
  const outputs = lastRun.outputs as KnowledgeOutputs | undefined
  const items = outputs?.items ?? []
  const diagnostics = outputs?.diagnostics

  if (!items.length && !diagnostics) {
    return null
  }

  return (
    <PanelCard className="space-y-2 bg-slate-50/70 p-3">
      {diagnostics ? (
        <div className="grid gap-1 text-[10px] text-slate-500 md:grid-cols-3">
          <span>知识库 {diagnostics.dataset_count} 个</span>
          <span>扫描分块 {diagnostics.total_chunk_count}</span>
          <span>参与排序 {diagnostics.filtered_chunk_count}</span>
        </div>
      ) : null}
      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <PanelCard
              key={item.chunk_id}
              className="space-y-1.5 border border-slate-200 bg-white p-2.5 shadow-none"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-[12px] font-semibold text-slate-800">
                  {item.dataset_name}
                  {' / '}
                  {item.document_name}
                </p>
                <PanelToken className="border-blue-100 text-blue-600">
                  score {item.score.toFixed(3)}
                </PanelToken>
              </div>
              <p className="text-[11px] leading-5 text-slate-600">{item.text}</p>
            </PanelCard>
          ))}
        </div>
      ) : null}
    </PanelCard>
  )
}
