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
  result?: KnowledgeItem[]
  documents?: KnowledgeItem[]
  diagnostics?: {
    dataset_count: number
    total_chunk_count: number
    filtered_chunk_count: number
  }
}

export const resolveKnowledgeLastRunItems = (
  outputs: KnowledgeOutputs | undefined,
): KnowledgeItem[] => {
  if (!outputs) {
    return []
  }

  if (Array.isArray(outputs.items) && outputs.items.length > 0) {
    return outputs.items
  }

  if (Array.isArray(outputs.result) && outputs.result.length > 0) {
    return outputs.result
  }

  if (Array.isArray(outputs.documents) && outputs.documents.length > 0) {
    return outputs.documents
  }

  return outputs.items ?? outputs.result ?? outputs.documents ?? []
}

export const PanelLastRunKnowledgeDetails = ({ lastRun }: { lastRun: NodeLastRunSnapshot }) => {
  const outputs = lastRun.outputs as KnowledgeOutputs | undefined
  const items = resolveKnowledgeLastRunItems(outputs)
  const diagnostics = outputs?.diagnostics

  if (!items.length && !diagnostics) {
    return null
  }

  return (
    <PanelCard className="min-w-0 space-y-2 overflow-hidden bg-slate-50/70 p-3">
      {diagnostics ? (
        <div className="grid min-w-0 gap-1 text-[10px] text-slate-500 md:grid-cols-3">
          <span className="min-w-0">知识库 {diagnostics.dataset_count} 个</span>
          <span className="min-w-0">扫描分块 {diagnostics.total_chunk_count}</span>
          <span className="min-w-0">参与排序 {diagnostics.filtered_chunk_count}</span>
        </div>
      ) : null}
      {items.length ? (
        <div className="min-w-0 space-y-2">
          {items.map((item) => (
            <PanelCard
              key={item.chunk_id}
              className="min-w-0 space-y-1.5 overflow-hidden border border-slate-200 bg-white p-2.5 shadow-none"
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <p className="min-w-0 flex-1 break-words text-[12px] font-semibold leading-5 text-slate-800">
                  {item.dataset_name}
                  {' / '}
                  {item.document_name}
                </p>
                <PanelToken className="shrink-0 border-blue-100 text-blue-600">
                  score {item.score.toFixed(3)}
                </PanelToken>
              </div>
              <p className="break-words text-[11px] leading-5 text-slate-600">{item.text}</p>
            </PanelCard>
          ))}
        </div>
      ) : null}
    </PanelCard>
  )
}
