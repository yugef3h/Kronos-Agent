import React, { useEffect, useMemo, useState } from 'react'
import { useReactFlow } from 'reactflow'
import type { PanelProps as NodePanelProps } from './custom-node'
import VariableSelect from '../base/variable-select'
import Field from '../base/field'
import PanelAlert from '../base/panel-alert'
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../base/dialog'
import {
  PanelCard,
  PanelChoiceGroup,
  PanelInput,
  PanelOutputVarRow,
  PanelSection,
  PanelSelect,
  PanelToggle,
  PanelToken,
} from '../base/panel-form'
import type { Edge } from '../types/common'
import type { CanvasNodeData } from '../types/canvas'
import type { VariableOption } from '../features/llm-panel/types'
import {
  KNOWLEDGE_ONE_WAY_MODEL_OPTIONS,
  KNOWLEDGE_RERANK_MODEL_OPTIONS,
} from '../features/knowledge-retrieval-panel/catalog'
import { useKnowledgeDatasets } from '../features/knowledge-retrieval-panel/dataset-store'
import { useKnowledgeRetrievalPanelConfig } from '../features/knowledge-retrieval-panel/use-knowledge-retrieval-panel-config'
import type {
  KnowledgeDatasetDetail,
  KnowledgeMetadataCondition,
  KnowledgeMetadataOperator,
  KnowledgeRetrievalNodeConfig,
} from '../features/knowledge-retrieval-panel/types'

type DatasetFormState = {
  name: string
  description: string
  is_multimodal: boolean
  doc_metadata: Array<{ key: string; label: string }>
}

const createEmptyDatasetForm = (): DatasetFormState => ({
  name: '',
  description: '',
  is_multimodal: false,
  doc_metadata: [],
})

const createDatasetFormFromDetail = (dataset?: KnowledgeDatasetDetail | null): DatasetFormState => ({
  name: dataset?.name ?? '',
  description: dataset?.description ?? '',
  is_multimodal: dataset?.is_multimodal ?? false,
  doc_metadata: dataset?.doc_metadata.map(field => ({ ...field })) ?? [],
})

const buildMetadataKey = (value: string, index: number) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')

  return normalized || `field_${index + 1}`
}

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

const buildVariableOptions = (
  currentNodeId: string,
  nodes: Array<{ id: string; data: CanvasNodeData }>,
): VariableOption[] => {
  const systemVariables: VariableOption[] = [
    {
      label: 'sys.query',
      valueSelector: ['sys', 'query'],
      valueType: 'string',
      source: 'system',
    },
    {
      label: 'sys.files',
      valueSelector: ['sys', 'files'],
      valueType: 'file',
      source: 'system',
    },
    {
      label: 'sys.conversation_id',
      valueSelector: ['sys', 'conversation_id'],
      valueType: 'string',
      source: 'system',
    },
  ]

  const nodeVariables = nodes
    .filter(node => node.id !== currentNodeId)
    .sort((left, right) => left.data.title.localeCompare(right.data.title, 'zh-CN'))
    .flatMap((node) => {
      const outputs = Object.keys(node.data.outputs ?? {})
      if (!outputs.length)
        return []

      return outputs.map<VariableOption>((outputKey) => ({
        label: `${node.data.title}.${outputKey}`,
        valueSelector: [node.id, outputKey],
        valueType: outputKey.includes('file')
          ? 'file'
          : outputKey === 'usage'
            ? 'object'
            : outputKey === 'result' || outputKey === 'documents'
              ? 'array'
              : 'string',
        source: 'node',
      }))
    })

  return [...systemVariables, ...nodeVariables]
}

const METADATA_OPERATOR_OPTIONS: Array<{ label: string; value: KnowledgeMetadataOperator }> = [
  { label: '包含', value: 'contains' },
  { label: '等于', value: 'equals' },
  { label: '不等于', value: 'not_equals' },
]

const MetadataConditionEditor = ({
  condition,
  metadataFields,
  onChange,
  onRemove,
}: {
  condition: KnowledgeMetadataCondition
  metadataFields: Array<{ key: string; label: string }>
  onChange: (patch: Partial<KnowledgeMetadataCondition>) => void
  onRemove: () => void
}) => {
  return (
    <PanelCard className="space-y-2 border-[#e8edf5] bg-white p-2.5 shadow-none">
      <div className="grid gap-1.5 md:grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)_auto]">
        <PanelSelect
          value={condition.field}
          onChange={(event) => onChange({ field: event.target.value })}
        >
          <option value="">选择 metadata</option>
          {metadataFields.map(field => (
            <option key={field.key} value={field.key}>{field.label}</option>
          ))}
        </PanelSelect>

        <PanelSelect
          value={condition.operator}
          onChange={(event) => onChange({ operator: event.target.value as KnowledgeMetadataOperator })}
        >
          {METADATA_OPERATOR_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </PanelSelect>

        <PanelInput
          value={condition.value}
          placeholder="过滤值"
          onChange={(event) => onChange({ value: event.target.value })}
        />

        <button
          type="button"
          onClick={onRemove}
          className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition hover:border-rose-200 hover:text-rose-600"
        >
          删除
        </button>
      </div>
    </PanelCard>
  )
}

const KnowledgeRetrievalPanel = ({ id, data }: NodePanelProps) => {
  const { getNodes, setNodes } = useReactFlow<CanvasNodeData, Edge>()
  const nodeData = data as CanvasNodeData
  const availableVariables = buildVariableOptions(
    id,
    getNodes().map(node => ({ id: node.id, data: node.data })),
  )
  const {
    datasets,
    isLoading: isDatasetLoading,
    isMutating: isDatasetMutating,
    errorMessage: datasetErrorMessage,
    refresh: refreshDatasets,
    createDataset,
    updateDataset,
    deleteDataset,
  } = useKnowledgeDatasets()
  const fileVariables = useMemo(
    () => availableVariables.filter(option => option.valueType === 'file'),
    [availableVariables],
  )
  const [activeTab, setActiveTab] = useState<'settings' | 'last-run'>('settings')
  const [isDatasetDialogOpen, setIsDatasetDialogOpen] = useState(false)
  const [editingDatasetId, setEditingDatasetId] = useState<string>('')
  const [datasetForm, setDatasetForm] = useState<DatasetFormState>(() => createEmptyDatasetForm())
  const [metadataDraft, setMetadataDraft] = useState({ key: '', label: '' })
  const [datasetFormError, setDatasetFormError] = useState('')
  const [datasetActionMessage, setDatasetActionMessage] = useState('')
  const {
    config,
    issues,
    selectedDatasets,
    metadataFields,
    showImageQueryVarSelector,
    handleQueryVariableChange,
    handleQueryAttachmentChange,
    handleDatasetToggle,
    handleRetrievalModeChange,
    handleSingleRetrievalConfigChange,
    handleMultipleRetrievalConfigChange,
    handleMetadataFilteringModeChange,
    handleAddMetadataCondition,
    handleUpdateMetadataCondition,
    handleRemoveMetadataCondition,
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

  const editingDataset = useMemo(
    () => datasets.find(dataset => dataset.id === editingDatasetId) ?? null,
    [datasets, editingDatasetId],
  )

  const openCreateDataset = () => {
    setEditingDatasetId('new')
    setDatasetForm(createEmptyDatasetForm())
    setMetadataDraft({ key: '', label: '' })
    setDatasetFormError('')
    setDatasetActionMessage('')
    setIsDatasetDialogOpen(true)
  }

  const selectDatasetForEdit = (dataset: KnowledgeDatasetDetail) => {
    setEditingDatasetId(dataset.id)
    setDatasetForm(createDatasetFormFromDetail(dataset))
    setMetadataDraft({ key: '', label: '' })
    setDatasetFormError('')
    setDatasetActionMessage('')
    setIsDatasetDialogOpen(true)
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

  useEffect(() => {
    if (!isDatasetDialogOpen)
      return

    if (editingDatasetId === 'new')
      return

    if (!editingDatasetId) {
      if (datasets[0]) {
        setEditingDatasetId(datasets[0].id)
        setDatasetForm(createDatasetFormFromDetail(datasets[0]))
      }
      return
    }

    if (!editingDataset && datasets[0]) {
      setEditingDatasetId(datasets[0].id)
      setDatasetForm(createDatasetFormFromDetail(datasets[0]))
      return
    }

    if (editingDataset) {
      setDatasetForm(createDatasetFormFromDetail(editingDataset))
    }
  }, [datasets, editingDataset, editingDatasetId, isDatasetDialogOpen])

  const handleAddMetadataField = () => {
    const nextLabel = metadataDraft.label.trim()
    const nextKey = buildMetadataKey(metadataDraft.key || nextLabel, datasetForm.doc_metadata.length)

    if (!nextLabel && !metadataDraft.key.trim()) {
      setDatasetFormError('metadata 字段至少需要 key 或 label。')
      return
    }

    if (datasetForm.doc_metadata.some(field => field.key === nextKey)) {
      setDatasetFormError('metadata key 不能重复。')
      return
    }

    setDatasetForm((current) => ({
      ...current,
      doc_metadata: [...current.doc_metadata, { key: nextKey, label: nextLabel || nextKey }],
    }))
    setMetadataDraft({ key: '', label: '' })
    setDatasetFormError('')
  }

  const handleSaveDataset = async () => {
    const nextName = datasetForm.name.trim()

    if (!nextName) {
      setDatasetFormError('知识库名称不能为空。')
      return
    }

    setDatasetFormError('')
    setDatasetActionMessage('')

    const payload = {
      name: nextName,
      description: datasetForm.description.trim(),
      is_multimodal: datasetForm.is_multimodal,
      doc_metadata: datasetForm.doc_metadata,
    }

    try {
      const savedDataset = editingDatasetId === 'new'
        ? await createDataset(payload)
        : await updateDataset(editingDatasetId, payload)

      setEditingDatasetId(savedDataset.id)
      setDatasetForm(createDatasetFormFromDetail(savedDataset))
      setDatasetActionMessage(editingDatasetId === 'new' ? '知识库已创建。' : '知识库已更新。')
    }
    catch (error) {
      setDatasetFormError(error instanceof Error ? error.message : '知识库保存失败。')
    }
  }

  const handleDeleteDataset = async (datasetId: string) => {
    const targetDataset = datasets.find(dataset => dataset.id === datasetId)
    if (!targetDataset)
      return

    if (!window.confirm(`确认删除知识库“${targetDataset.name}”？`)) {
      return
    }

    try {
      await deleteDataset(datasetId)
      setDatasetActionMessage('知识库已删除。')
      setDatasetFormError('')
      setEditingDatasetId('')
    }
    catch (error) {
      setDatasetFormError(error instanceof Error ? error.message : '知识库删除失败。')
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
          <PanelCard className="space-y-1.5 bg-slate-50/70 p-3">
            <p className="text-[12px] font-semibold text-slate-800">暂无最近一次运行记录</p>
            <p className="text-[11px] leading-5 text-slate-500">
              运行工作流后，这里会展示查询变量、命中的知识库和检索返回结果，便于排查召回链路。
            </p>
          </PanelCard>
        ) : null}
      </div>

      {activeTab === 'settings' ? (
        <>
          <PanelSection title="查询输入">
            <PanelAlert type="info">
              查询文本和附件都来自变量。多模态知识库被选中后，附件输入会自动出现。
            </PanelAlert>
            {issues.length ? (
              <PanelAlert type="warning">{issues[0].message}</PanelAlert>
            ) : null}
            <PanelCard className="space-y-2.5 bg-white p-2.5 shadow-none">
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

          <PanelSection title="知识库">
            <PanelCard className="space-y-2 bg-white p-2.5 shadow-none">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2">
                <div>
                  <p className="text-[12px] font-semibold text-slate-800">服务端知识库目录</p>
                  <p className="text-[10px] text-slate-500">
                    {isDatasetLoading ? '正在同步最新知识库...' : `共 ${datasets.length} 个知识库`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void refreshDatasets()}
                    disabled={isDatasetLoading || isDatasetMutating}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    刷新
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDatasetDialogOpen(true)
                      if (datasets[0] && !editingDatasetId) {
                        setEditingDatasetId(datasets[0].id)
                        setDatasetForm(createDatasetFormFromDetail(datasets[0]))
                      }
                    }}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                  >
                    管理
                  </button>
                </div>
              </div>
              {datasetErrorMessage ? (
                <PanelAlert type="warning">{datasetErrorMessage}</PanelAlert>
              ) : null}
              <div className="grid gap-2">
                {datasets.map(dataset => {
                  const selected = config.dataset_ids.includes(dataset.id)

                  return (
                    <button
                      key={dataset.id}
                      type="button"
                      onClick={() => handleDatasetToggle(dataset.id)}
                      className={`rounded-xl border px-3 py-2 text-left transition ${selected
                        ? 'border-blue-300 bg-blue-50/60 shadow-[0_6px_14px_rgba(59,130,246,0.12)]'
                        : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-semibold text-slate-800">{dataset.name}</p>
                          <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{dataset.description}</p>
                          {typeof dataset.documentCount === 'number' ? (
                            <p className="mt-1 text-[10px] text-slate-400">{dataset.documentCount} 条文档</p>
                          ) : null}
                        </div>
                        {dataset.is_multimodal ? (
                          <PanelToken className="border-amber-100 text-amber-600">多模态</PanelToken>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
              {selectedDatasets.length ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedDatasets.map(dataset => (
                    <PanelToken key={dataset.id}>{dataset.name}</PanelToken>
                  ))}
                </div>
              ) : null}
            </PanelCard>
          </PanelSection>

          <PanelSection title="检索策略">
            <PanelCard className="space-y-2.5 bg-white p-2.5 shadow-none">
              <Field title="检索模式" compact>
                <PanelChoiceGroup
                  size="sm"
                  value={config.retrieval_mode}
                  options={[
                    { label: '单路召回', value: 'oneWay' },
                    { label: '混合召回', value: 'multiWay' },
                  ]}
                  onChange={value => handleRetrievalModeChange(value)}
                />
              </Field>

              {config.retrieval_mode === 'oneWay' ? (
                <>
                  <Field title="检索模型" compact>
                    <PanelSelect
                      value={config.single_retrieval_config.model}
                      onChange={(event) => handleSingleRetrievalConfigChange('model', event.target.value)}
                    >
                      {KNOWLEDGE_ONE_WAY_MODEL_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </PanelSelect>
                  </Field>
                  <div className="grid gap-1.5 md:grid-cols-2">
                    <Field title="Top K" compact>
                      <PanelInput
                        type="number"
                        value={config.single_retrieval_config.top_k}
                        onChange={(event) => handleSingleRetrievalConfigChange('top_k', Number(event.target.value) || 1)}
                      />
                    </Field>
                    <Field title="Score Threshold" compact>
                      <PanelInput
                        type="number"
                        step="0.01"
                        value={config.single_retrieval_config.score_threshold ?? ''}
                        onChange={(event) => handleSingleRetrievalConfigChange(
                          'score_threshold',
                          event.target.value === '' ? null : Number(event.target.value),
                        )}
                      />
                    </Field>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-1.5 md:grid-cols-2">
                    <Field title="Top K" compact>
                      <PanelInput
                        type="number"
                        value={config.multiple_retrieval_config.top_k}
                        onChange={(event) => handleMultipleRetrievalConfigChange('top_k', Number(event.target.value) || 1)}
                      />
                    </Field>
                    <Field title="Score Threshold" compact>
                      <PanelInput
                        type="number"
                        step="0.01"
                        value={config.multiple_retrieval_config.score_threshold ?? ''}
                        onChange={(event) => handleMultipleRetrievalConfigChange(
                          'score_threshold',
                          event.target.value === '' ? null : Number(event.target.value),
                        )}
                      />
                    </Field>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-2.5 py-2">
                    <div>
                      <p className="text-[12px] font-semibold text-slate-800">启用 Rerank</p>
                      <p className="text-[10px] text-slate-500">多知识库或召回结果较杂时建议开启。</p>
                    </div>
                    <PanelToggle
                      checked={config.multiple_retrieval_config.reranking_enable}
                      onChange={(checked) => handleMultipleRetrievalConfigChange('reranking_enable', checked)}
                    />
                  </div>
                  {config.multiple_retrieval_config.reranking_enable ? (
                    <Field title="Rerank 模型" compact>
                      <PanelSelect
                        value={config.multiple_retrieval_config.reranking_model}
                        onChange={(event) => handleMultipleRetrievalConfigChange('reranking_model', event.target.value)}
                      >
                        {KNOWLEDGE_RERANK_MODEL_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </PanelSelect>
                    </Field>
                  ) : null}
                </>
              )}
            </PanelCard>
          </PanelSection>

          <PanelSection title="Metadata 过滤">
            <PanelCard className="space-y-2.5 bg-white p-2.5 shadow-none">
              <Field title="过滤模式" compact>
                <PanelChoiceGroup
                  size="sm"
                  value={config.metadata_filtering_mode}
                  options={[
                    { label: '关闭', value: 'disabled' },
                    { label: '条件过滤', value: 'manual' },
                  ]}
                  onChange={(value) => handleMetadataFilteringModeChange(value)}
                />
              </Field>

              {config.metadata_filtering_mode === 'manual' ? (
                metadataFields.length ? (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {metadataFields.map(field => (
                        <PanelToken key={field.key}>{field.label}</PanelToken>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {config.metadata_filtering_conditions.map(condition => (
                        <MetadataConditionEditor
                          key={condition.id}
                          condition={condition}
                          metadataFields={metadataFields}
                          onChange={patch => handleUpdateMetadataCondition(condition.id, patch)}
                          onRemove={() => handleRemoveMetadataCondition(condition.id)}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddMetadataCondition}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-600"
                    >
                      <span className="text-sm leading-none">+</span>
                      添加条件
                    </button>
                  </>
                ) : (
                  <PanelAlert type="warning">
                    当前所选知识库没有公共 metadata 字段，无法配置条件过滤。
                  </PanelAlert>
                )
              ) : (
                <p className="text-[11px] leading-5 text-slate-500">
                  关闭后将不过滤 metadata，直接交给检索引擎完成召回。
                </p>
              )}
            </PanelCard>
          </PanelSection>

          <PanelSection title="输出变量">
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
          </PanelSection>

          <Dialog open={isDatasetDialogOpen} onOpenChange={setIsDatasetDialogOpen}>
            <DialogContent className="w-[760px] max-w-[calc(100vw-1rem)] overflow-hidden p-0">
              <div className="flex items-start justify-between border-b border-slate-100 px-4 py-4">
                <div className="pr-8">
                  <DialogTitle>
                    <span className="text-[15px] font-semibold text-slate-900">知识库管理</span>
                  </DialogTitle>
                  <DialogDescription>
                    <span className="mt-1 block text-[12px] leading-5 text-slate-500">
                      这里维护知识检索节点可选的数据集。保存后会同步到服务端，并自动更新当前工作流节点。
                    </span>
                  </DialogDescription>
                </div>
                <DialogCloseButton className="right-4 top-4" />
              </div>

              <div className="grid min-h-[460px] md:grid-cols-[230px_minmax(0,1fr)]">
                <div className="border-b border-slate-100 bg-slate-50/70 p-3 md:border-b-0 md:border-r">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Datasets</p>
                    <button
                      type="button"
                      onClick={openCreateDataset}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-600"
                    >
                      新建
                    </button>
                  </div>

                  <div className="space-y-2">
                    {datasets.map(dataset => {
                      const isActive = editingDatasetId === dataset.id

                      return (
                        <button
                          key={dataset.id}
                          type="button"
                          onClick={() => selectDatasetForEdit(dataset)}
                          className={`w-full rounded-xl border px-2.5 py-2 text-left transition ${isActive
                            ? 'border-blue-300 bg-white shadow-[0_10px_22px_-18px_rgba(59,130,246,0.35)]'
                            : 'border-transparent bg-white/70 hover:border-slate-200 hover:bg-white'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-semibold text-slate-800">{dataset.name}</p>
                              <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-slate-500">{dataset.description || '未填写描述'}</p>
                            </div>
                            {dataset.is_multimodal ? (
                              <PanelToken className="border-amber-100 text-amber-600">图文</PanelToken>
                            ) : null}
                          </div>
                          <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                            <span>{dataset.documentCount ?? 0} 条文档</span>
                            <span>{formatDatasetUpdatedAt(dataset.updatedAt)}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold text-slate-900">
                        {editingDatasetId === 'new' ? '新建知识库' : editingDataset?.name || '编辑知识库'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {editingDatasetId === 'new'
                          ? '保存后会生成稳定 dataset id，并立即出现在选择区。'
                          : `数据集 ID：${editingDataset?.id || '未选中'}`}
                      </p>
                    </div>
                    {editingDatasetId !== 'new' && editingDataset ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteDataset(editingDataset.id)}
                        disabled={isDatasetMutating}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        删除
                      </button>
                    ) : null}
                  </div>

                  {datasetFormError ? (
                    <PanelAlert type="warning">{datasetFormError}</PanelAlert>
                  ) : null}
                  {datasetActionMessage ? (
                    <PanelAlert type="info">{datasetActionMessage}</PanelAlert>
                  ) : null}
                  {datasetErrorMessage && !datasetFormError ? (
                    <PanelAlert type="warning">{datasetErrorMessage}</PanelAlert>
                  ) : null}

                  <PanelCard className="space-y-2.5 bg-white p-3 shadow-none">
                    <Field title="知识库名称" compact>
                      <PanelInput
                        value={datasetForm.name}
                        placeholder="例如：售后案例库"
                        onChange={event => setDatasetForm(current => ({ ...current, name: event.target.value }))}
                      />
                    </Field>

                    <Field title="描述" compact>
                      <textarea
                        value={datasetForm.description}
                        rows={3}
                        placeholder="说明这个知识库覆盖的业务域、文档来源和适用范围。"
                        onChange={event => setDatasetForm(current => ({ ...current, description: event.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                    </Field>

                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2">
                      <div>
                        <p className="text-[12px] font-semibold text-slate-800">多模态知识库</p>
                        <p className="text-[10px] text-slate-500">开启后，节点会展示附件变量入口。</p>
                      </div>
                      <PanelToggle
                        checked={datasetForm.is_multimodal}
                        onChange={checked => setDatasetForm(current => ({ ...current, is_multimodal: checked }))}
                      />
                    </div>
                  </PanelCard>

                  <PanelCard className="space-y-2.5 bg-white p-3 shadow-none">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[12px] font-semibold text-slate-800">Metadata 字段</p>
                        <p className="text-[10px] text-slate-500">这些字段会进入条件过滤交集计算。</p>
                      </div>
                      <span className="text-[10px] text-slate-400">{datasetForm.doc_metadata.length} 个字段</span>
                    </div>

                    {datasetForm.doc_metadata.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {datasetForm.doc_metadata.map((field, index) => (
                          <span
                            key={field.key}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600"
                          >
                            <span>{field.label}</span>
                            <span className="text-slate-400">/{field.key}</span>
                            <button
                              type="button"
                              onClick={() => setDatasetForm(current => ({
                                ...current,
                                doc_metadata: current.doc_metadata.filter((_, currentIndex) => currentIndex !== index),
                              }))}
                              className="text-slate-400 transition hover:text-rose-600"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500">当前还没有 metadata 字段，过滤区会自动隐藏。</p>
                    )}

                    <div className="grid gap-2 md:grid-cols-[minmax(0,120px)_minmax(0,1fr)_auto]">
                      <PanelInput
                        value={metadataDraft.key}
                        placeholder="key，例如 brand"
                        onChange={event => setMetadataDraft(current => ({ ...current, key: event.target.value }))}
                      />
                      <PanelInput
                        value={metadataDraft.label}
                        placeholder="显示名，例如 品牌"
                        onChange={event => setMetadataDraft(current => ({ ...current, label: event.target.value }))}
                      />
                      <button
                        type="button"
                        onClick={handleAddMetadataField}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-600"
                      >
                        添加字段
                      </button>
                    </div>
                  </PanelCard>

                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-1">
                    <p className="text-[10px] text-slate-400">
                      {isDatasetMutating ? '正在写入服务端...' : '保存后立即同步到 dataset API'}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsDatasetDialogOpen(false)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:border-slate-300"
                      >
                        关闭
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveDataset()}
                        disabled={isDatasetMutating}
                        className="rounded-lg border border-blue-300 bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {editingDatasetId === 'new' ? '创建知识库' : '保存修改'}
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