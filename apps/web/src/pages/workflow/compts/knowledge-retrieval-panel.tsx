import React, { useEffect, useMemo, useState } from 'react'
import { useReactFlow } from 'reactflow'
import type { PanelProps as NodePanelProps } from './custom-node'
import VariableSelect from '../base/variable-select'
import Field from '../base/field'
import PanelAlert from '../base/panel-alert'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '../base/dialog'
import {
  PanelCard,
  PanelFieldRenderer,
  PanelOutputVarRow,
  PanelSection,
  PanelToken,
} from '../base/panel-form'
import {
  requestKnowledgeRetrievalQuery,
} from '../../../lib/api'
import type { Edge } from '../types/common'
import type { CanvasNodeData } from '../types/canvas'
import {
  ensureKnowledgeDatasetAuthToken,
  useKnowledgeDatasets,
} from '../features/knowledge-retrieval-panel/dataset-store'
import { useKnowledgeRetrievalPanelConfig } from '../features/knowledge-retrieval-panel/use-knowledge-retrieval-panel-config'
import type {
  KnowledgeDatasetDetail,
  KnowledgeRetrievalDebugRun,
  KnowledgeRetrievalNodeConfig,
} from '../features/knowledge-retrieval-panel/types'
import type { PanelFieldControl } from '../base/panel-form'
import { buildWorkflowVariableOptions, serializeValueSelector } from '../utils/variable-options'
import { buildKnowledgeDatasetPagePath } from '../features/knowledge-retrieval-panel/navigation'

type NumberSliderFieldConfig = Extract<PanelFieldControl, { controlType: 'numberSlider' }>

const formatDatasetUpdatedAt = (value?: number) => {
  if (!value)
    return '未同步'

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

const getDatasetPickerBadgeLabel = (dataset: KnowledgeDatasetDetail) => {
  const indexingLabel = dataset.indexing_technique === 'high_quality' ? '高质量' : '经济'
  const searchMethodLabelMap = {
    semantic_search: '向量检索',
    full_text_search: '全文检索',
    keyword_search: '关键词检索',
    hybrid_search: '混合检索',
  } as const

  const searchMethodLabel = dataset.retrieval_model?.search_method
    ? searchMethodLabelMap[dataset.retrieval_model.search_method]
    : '向量检索'

  return `${indexingLabel} · ${searchMethodLabel}`
}

const collectUpstreamNodeIds = (currentNodeId: string, edges: Array<{ source: string; target: string }>) => {
  const visited = new Set<string>()
  const pending = [currentNodeId]

  while (pending.length) {
    const targetNodeId = pending.pop()
    if (!targetNodeId)
      continue

    edges
      .filter(edge => edge.target === targetNodeId)
      .forEach((edge) => {
        if (visited.has(edge.source))
          return

        visited.add(edge.source)
        pending.push(edge.source)
      })
  }

  return visited
}

const TopKControl = ({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) => {
  const field: NumberSliderFieldConfig = {
    controlType: 'numberSlider',
    value,
    min: 1,
    max: 20,
    step: 1,
    inputMin: 1,
    inputMax: 100,
    onChange: (nextValue) => onChange(Math.max(1, Math.round(nextValue ?? value))),
  }

  return (
    <PanelFieldRenderer field={field} />
  )
}

const KnowledgeRetrievalPanel = ({ id, data }: NodePanelProps) => {
  const { getEdges, getNodes, setNodes } = useReactFlow<CanvasNodeData, Edge>()
  const nodeData = data as CanvasNodeData
  const availableVariables = useMemo(() => {
    const nodes = getNodes().map(node => ({ id: node.id, data: node.data, parentId: node.parentId }))
    const upstreamNodeIds = collectUpstreamNodeIds(id, getEdges())
    const variableOptions = buildWorkflowVariableOptions(id, nodes)

    return variableOptions.filter((option) => {
      if (option.source === 'system')
        return true

      return upstreamNodeIds.has(option.valueSelector[0] ?? '')
    })
  }, [getEdges, getNodes, id])
  const {
    datasets,
    isLoading: isDatasetLoading,
    errorMessage: datasetErrorMessage,
    refresh: refreshDatasets,
  } = useKnowledgeDatasets()
  const fileVariables = useMemo(
    () => availableVariables.filter(option => option.valueType === 'file'),
    [availableVariables],
  )
  const [activeTab, setActiveTab] = useState<'settings' | 'last-run'>('settings')
  const [isDatasetPickerOpen, setIsDatasetPickerOpen] = useState(false)
  const [pendingDatasetIds, setPendingDatasetIds] = useState<string[]>([])
  const [debugQuery, setDebugQuery] = useState('')
  const [debugRunError, setDebugRunError] = useState('')
  const [isDebugRunning, setIsDebugRunning] = useState(false)
  const [isOutputVarsExpanded, setIsOutputVarsExpanded] = useState(false)
  const lastRun = nodeData._knowledgeLastRun ?? null
  const {
    config,
    issues,
    selectedDatasets,
    showImageQueryVarSelector,
    handleQueryVariableChange,
    handleQueryAttachmentChange,
    handleDatasetIdsChange,
    handleTopKChange,
  } = useKnowledgeRetrievalPanelConfig({
    value: nodeData.inputs,
    datasets,
    onChange: (nextValue: KnowledgeRetrievalNodeConfig) => {
      setNodes((nodes) => nodes.map((node) => {
        if (node.id !== id)
          return node

        return {
          ...node,
          data: {
            ...node.data,
            inputs: nextValue as unknown as Record<string, unknown>,
            _datasets: datasets.filter(dataset => nextValue.dataset_ids.includes(dataset.id)),
            outputs: {
              result: [],
              documents: [],
              files: [],
              ...(node.data.outputs ?? {}),
            },
          },
        }
      }))
    },
  })

  const topKValue = config.retrieval_mode === 'oneWay'
    ? config.single_retrieval_config.top_k
    : config.multiple_retrieval_config.top_k

  const openDatasetPicker = () => {
    setPendingDatasetIds(config.dataset_ids)
    setIsDatasetPickerOpen(true)
    void refreshDatasets()
  }

  const openKnowledgeDatasetPage = () => {
    const targetPath = buildKnowledgeDatasetPagePath(config.dataset_ids[0] ?? datasets[0]?.id)
    const openedWindow = window.open(targetPath, '_blank', 'noopener,noreferrer')
    if (!openedWindow)
      window.location.assign(targetPath)
  }

  const handlePendingDatasetToggle = (datasetId: string) => {
    setPendingDatasetIds((current) => {
      const exists = current.includes(datasetId)
      return exists
        ? current.filter(id => id !== datasetId)
        : [...current, datasetId]
    })
  }

  const handleConfirmDatasetSelection = () => {
    if (!pendingDatasetIds.length)
      return

    handleDatasetIdsChange(pendingDatasetIds)
    setIsDatasetPickerOpen(false)
  }

  const handleTopKValueChange = (value: number | null) => {
    const nextValue = Math.max(1, Math.round(value ?? 1))
    handleTopKChange(nextValue)
  }

  useEffect(() => {
    const rawInputs = JSON.stringify(nodeData.inputs ?? null)
    const normalizedInputs = JSON.stringify(config)
    const normalizedDatasets = JSON.stringify(selectedDatasets)
    const rawDatasets = JSON.stringify(nodeData._datasets ?? [])
    const outputs = nodeData.outputs ?? {}
    const hasOutputShape = 'result' in outputs && 'documents' in outputs && 'files' in outputs

    if (rawInputs !== normalizedInputs || rawDatasets !== normalizedDatasets || !hasOutputShape) {
      setNodes((nodes) => nodes.map((node) => {
        if (node.id !== id)
          return node

        return {
          ...node,
          data: {
            ...node.data,
            inputs: config as unknown as Record<string, unknown>,
            _datasets: selectedDatasets,
            outputs: {
              result: [],
              documents: [],
              files: [],
              ...(node.data.outputs ?? {}),
            },
          },
        }
      }))
    }
  }, [config, id, nodeData._datasets, nodeData.inputs, nodeData.outputs, selectedDatasets, setNodes])

  const handleRunDebugQuery = async () => {
    const nextQuery = debugQuery.trim()
    if (!nextQuery) {
      setDebugRunError('请输入调试查询内容。')
      return
    }

    if (!config.dataset_ids.length) {
      setDebugRunError('请先至少选择一个知识库。')
      return
    }

    setIsDebugRunning(true)
    setDebugRunError('')

    try {
      const authToken = await ensureKnowledgeDatasetAuthToken()
      if (!authToken) {
        throw new Error('知识库接口需要 JWT 鉴权')
      }

      const result = await requestKnowledgeRetrievalQuery({
        authToken,
        input: {
          query: nextQuery,
          dataset_ids: config.dataset_ids,
          retrieval_mode: config.retrieval_mode,
          single_retrieval_config: config.single_retrieval_config,
          multiple_retrieval_config: config.multiple_retrieval_config,
          metadata_filtering_mode: 'disabled',
          metadata_filtering_conditions: [],
        },
      })

      const nextRun: KnowledgeRetrievalDebugRun = {
        requestedAt: Date.now(),
        query: nextQuery,
        items: result.items,
        diagnostics: result.diagnostics,
      }

      setNodes((nodes) => nodes.map((node) => {
        if (node.id !== id)
          return node

        return {
          ...node,
          data: {
            ...node.data,
            _knowledgeLastRun: nextRun,
          },
        }
      }))
    }
    catch (error) {
      setDebugRunError(error instanceof Error ? error.message : '知识检索调试失败。')
    }
    finally {
      setIsDebugRunning(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 border-b border-slate-100 pb-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-0.5">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition ${
                activeTab === 'settings'
                  ? 'bg-white text-slate-900 shadow-[0_6px_14px_rgba(15,23,42,0.08)]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              设置
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('last-run')}
              className={`flex-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition ${
                activeTab === 'last-run'
                  ? 'bg-white text-slate-900 shadow-[0_6px_14px_rgba(15,23,42,0.08)]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              上次运行
            </button>
          </div>
        </div>

        {activeTab === 'last-run' ? (
          <PanelCard className="space-y-3 bg-slate-50/70 p-3">
            <div className="space-y-1">
              <p className="text-[12px] font-semibold text-slate-800">手动检索调试</p>
              <p className="text-[11px] leading-5 text-slate-500">
                这里直接调用服务端知识检索接口，先验证当前节点绑定的知识库与召回参数是否有效。
              </p>
            </div>

            <div className="grid gap-2">
              <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-500">
                <p>查询变量：{config.query_variable_selector.length ? serializeValueSelector(config.query_variable_selector) : '未设置'}</p>
                <p>Top K：{topKValue}</p>
              </div>

              {selectedDatasets.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedDatasets.map(dataset => (
                    <PanelToken key={dataset.id}>{dataset.name}</PanelToken>
                  ))}
                </div>
              ) : null}

              <Field title="调试查询" compact>
                <textarea
                  value={debugQuery}
                  rows={3}
                  placeholder="输入一段查询文本，验证当前知识库配置是否能召回结果。"
                  onChange={event => setDebugQuery(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </Field>

              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] text-slate-400">
                  {lastRun ? `最近一次调试：${formatDatasetUpdatedAt(lastRun.requestedAt)}` : '还没有调试记录'}
                </p>
                <button
                  type="button"
                  onClick={() => void handleRunDebugQuery()}
                  disabled={isDebugRunning || isDatasetLoading}
                  className="rounded-lg border border-blue-300 bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDebugRunning ? '检索中...' : '运行检索'}
                </button>
              </div>

              {debugRunError ? (
                <PanelAlert type="warning">{debugRunError}</PanelAlert>
              ) : null}

              {lastRun ? (
                <div className="space-y-2">
                  <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                    <p className="text-[12px] font-semibold text-slate-800">{lastRun.query}</p>
                    <div className="mt-1 grid gap-1 text-[10px] text-slate-500 md:grid-cols-3">
                      <span>知识库 {lastRun.diagnostics.dataset_count} 个</span>
                      <span>扫描分块 {lastRun.diagnostics.total_chunk_count}</span>
                      <span>参与排序 {lastRun.diagnostics.filtered_chunk_count}</span>
                    </div>
                  </div>

                  {lastRun.items.length ? (
                    <div className="space-y-2">
                      {lastRun.items.map((item) => (
                        <PanelCard
                          key={item.chunk_id}
                          className="space-y-1.5 border border-slate-200 bg-white p-2.5 shadow-none"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-semibold text-slate-800">
                                {item.dataset_name} / {item.document_name}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                chunk #{item.chunk_index + 1} · {item.search_method}
                              </p>
                            </div>
                            <PanelToken className="border-blue-100 text-blue-600">
                              score {item.score.toFixed(3)}
                            </PanelToken>
                          </div>
                          <p className="text-[11px] leading-5 text-slate-600">{item.text}</p>
                          {item.matched_terms.length ? (
                            <div className="flex flex-wrap gap-1.5">
                              {item.matched_terms.map(term => (
                                <PanelToken key={`${item.chunk_id}-${term}`}>{term}</PanelToken>
                              ))}
                            </div>
                          ) : null}
                        </PanelCard>
                      ))}
                    </div>
                  ) : (
                    <PanelAlert type="info">本次检索没有命中结果。</PanelAlert>
                  )}
                </div>
              ) : null}
            </div>
          </PanelCard>
        ) : null}
      </div>

      {activeTab === 'settings' ? (
        <>
          <PanelSection title="查询输入">
            {issues.length ? (
              <PanelAlert type="warning">{issues[0].message}</PanelAlert>
            ) : null}
            <PanelCard className="space-y-2.5 bg-white shadow-none">
              <Field title="查询变量" compact>
                <VariableSelect
                  value={config.query_variable_selector}
                  options={availableVariables}
                  placeholder="选择查询变量"
                  onChange={handleQueryVariableChange}
                />
              </Field>
              {showImageQueryVarSelector ? (
                <Field title="查询附件" compact>
                  <VariableSelect
                    value={config.query_attachment_selector}
                    options={fileVariables}
                    placeholder="选择附件变量"
                    onChange={handleQueryAttachmentChange}
                  />
                </Field>
              ) : null}
            </PanelCard>
          </PanelSection>

          <PanelSection
            title="知识库"
            aside={(
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openDatasetPicker}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white text-[15px] text-slate-600 transition hover:bg-[#c8ceda33]"
                  aria-label="添加知识库"
                >
                  +
                </button>
              </div>
            )}
          >
            <PanelCard className="space-y-2 bg-white p-1.5 shadow-none">
              {datasetErrorMessage ? (
                <PanelAlert type="warning">{datasetErrorMessage}</PanelAlert>
              ) : null}
              {selectedDatasets.length ? (
                <div className="grid gap-2">
                  {selectedDatasets.map(dataset => (
                    <div
                      key={dataset.id}
                      className="rounded-xl bg-white"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-semibold text-slate-800">{dataset.name} <span className='text-[11px] text-slate-400 ml-2'>{dataset.description || '未填写描述'}</span></p>
                        </div>
                        {dataset.is_multimodal ? (
                          <PanelToken className="border-amber-100 text-amber-600">多模态</PanelToken>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl text-[11px] text-slate-500">
                  还没有引用知识库，点击右上角 + 添加。
                </div>
              )}
            </PanelCard>
          </PanelSection>

          <PanelSection title="检索策略">
            <PanelCard className="space-y-2.5 bg-white p-2.5 shadow-none">
              <Field title="Top K" compact>
                <TopKControl
                  value={topKValue}
                  onChange={handleTopKValueChange}
                />
              </Field>
            </PanelCard>
          </PanelSection>

          <PanelSection
            title="输出变量"
            aside={(
              <button
                type="button"
                onClick={() => setIsOutputVarsExpanded(expanded => !expanded)}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                aria-label={isOutputVarsExpanded ? '收起输出变量' : '展开输出变量'}
              >
                <svg
                  viewBox="0 0 1024 1024"
                  width="14"
                  height="14"
                  className={`transition-transform ${isOutputVarsExpanded ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                >
                  <path d="M512 640l-181.034667-180.992 60.373334-60.330667L512 519.338667l120.661333-120.661334 60.373334 60.330667L512 640.042667z" fill="currentColor"></path>
                </svg>
              </button>
            )}
          >
            {isOutputVarsExpanded ? (
              <PanelCard className="space-y-2 bg-white p-2.5 shadow-none">
                <PanelOutputVarRow
                  name="result"
                  type="Array[Object]"
                  description="知识检索主输出，包含内容、标题、来源地址、metadata 与关联文件。"
                />
                <PanelOutputVarRow
                  name="documents"
                  type="Array[Object]"
                  description="兼容型输出，保留召回文档列表，便于老节点继续引用。"
                />
                <PanelOutputVarRow
                  name="files"
                  type="Array[File]"
                  description="检索命中后附带返回的文件对象或图片资源。"
                />
              </PanelCard>
            ) : null}
          </PanelSection>

          <Dialog open={isDatasetPickerOpen} onOpenChange={setIsDatasetPickerOpen}>
            <DialogContent className="w-[420px] max-w-[calc(100vw-1rem)] p-0">
              <div className="px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <DialogTitle>
                      <span className="text-[15px] font-semibold text-slate-900">关联知识库</span>
                    </DialogTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void refreshDatasets()}
                      disabled={isDatasetLoading}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="刷新知识库列表"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                        <path d="M20 12a8 8 0 1 1-2.343-5.657" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M20 4v6h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={openKnowledgeDatasetPage}
                      className="inline-flex h-7 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      新建/管理
                    </button>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {datasetErrorMessage ? (
                    <PanelAlert type="warning">{datasetErrorMessage}</PanelAlert>
                  ) : null}

                  {datasets.length ? (
                    <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1">
                      {datasets.map((dataset) => {
                        const selected = pendingDatasetIds.includes(dataset.id)

                        return (
                          <button
                            key={dataset.id}
                            type="button"
                            onClick={() => handlePendingDatasetToggle(dataset.id)}
                            className={`rounded-2xl border px-4 py-3 text-left transition ${selected
                              ? 'border-blue-500 bg-blue-50 shadow-[0_10px_24px_-20px_rgba(59,130,246,0.45)]'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'} focus:outline-none focus-visible:ring-0 focus-visible:ring-blue-100`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600">
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <path d="M6 5.5h12v13H6z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M9 9.5h6M9 13h6M9 16.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-[12px] font-semibold text-slate-800">{dataset.name}</p>
                                  <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{dataset.description || '未填写描述'}</p>
                                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                                    <span>{dataset.documentCount ?? 0} 文档</span>
                                    <span>{dataset.chunkCount ?? 0} chunks</span>
                                    <span>{formatDatasetUpdatedAt(dataset.updatedAt)}</span>
                                  </div>
                                </div>
                              </div>
                              <PanelToken className="!border-slate-200 !text-slate-500">{getDatasetPickerBadgeLabel(dataset)}</PanelToken>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center">
                      <p className="text-[12px] font-semibold text-slate-700">还没有可关联的知识库</p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">去知识库页面新建或导入后，这里会自动刷新并列出已有项。</p>
                      <button
                        type="button"
                        onClick={openKnowledgeDatasetPage}
                        className="mt-3 inline-flex h-8 items-center rounded-lg border border-blue-300 bg-blue-600 px-3 text-[12px] font-semibold text-white transition hover:bg-blue-500"
                      >
                        去知识库页创建
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-4">
                    <p className={`text-[11px] font-semibold ${pendingDatasetIds.length ? 'text-slate-700' : 'text-amber-700'}`}>
                      {pendingDatasetIds.length ? `${pendingDatasetIds.length} 个知识库被选中` : '至少选择 1 个知识库'}
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIsDatasetPickerOpen(false)}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-[12px] font-semibold text-slate-600 transition hover:border-slate-300"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDatasetSelection}
                        disabled={!pendingDatasetIds.length}
                        className="rounded-xl border border-blue-300 bg-blue-600 px-5 py-2 text-[12px] font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        添加
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  )
}

export default React.memo(KnowledgeRetrievalPanel)