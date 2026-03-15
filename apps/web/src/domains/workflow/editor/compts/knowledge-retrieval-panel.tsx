import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useEdges, useNodes, useReactFlow } from 'reactflow'
import type { PanelProps as NodePanelProps } from './custom-node'
import VariableSelect from '../../../../components/form/variable-select'
import Field from '../base/field'
import PanelAlert from '../base/panel-alert'
import {
  PanelCard,
  PanelFieldRenderer,
  PanelOutputVarRow,
  PanelSection,
  PanelToken,
  usePanelTabs,
} from '../base/panel-form'
import PanelLastRun from '../base/panel-last-run'
import { PanelLastRunKnowledgeDetails } from '../base/panel-last-run-knowledge'
import { useRegisterPanelNodeDebug } from '../base/panel-node-debug-context'
import { useNodeDebugRun } from '../hooks/use-node-debug-run'
import { PanelRunDebugButton } from '../base/panel-run-debug-button'
import { useWorkflowAppId } from '../hooks/use-workflow-app-id'
import { resolveNodeLastRun } from '../utils/resolve-node-last-run'
import type { Edge } from '../types/common'
import type { CanvasNodeData } from '../types/canvas'
import { useKnowledgeDatasets } from '../panels/knowledge-retrieval-panel/dataset-store'
import { useKnowledgeRetrievalPanelConfig } from '../panels/knowledge-retrieval-panel/use-knowledge-retrieval-panel-config'
import type { KnowledgeRetrievalNodeConfig } from '../panels/knowledge-retrieval-panel/types'
import type { PanelFieldControl } from '../base/panel-form'
import { buildWorkflowVariableOptions, serializeValueSelector } from '../utils/variable-options'
import {
  formatDatasetUpdatedAt,
  KnowledgeDatasetPickerDialog,
} from '../../../../components/knowledge-dataset-picker-dialog'

type NumberSliderFieldConfig = Extract<PanelFieldControl, { controlType: 'numberSlider' }>

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
  const { setNodes } = useReactFlow<CanvasNodeData, Edge>()
  const nodes = useNodes<CanvasNodeData>()
  const edges = useEdges<Edge>()
  const nodeData = data as CanvasNodeData
  const availableVariables = useMemo(() => {
    const nodeSnapshots = nodes.map(node => ({ id: node.id, data: node.data, parentId: node.parentId }))
    return buildWorkflowVariableOptions(id, nodeSnapshots, edges)
  }, [edges, id, nodes])
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
  const { activeTab } = usePanelTabs()
  const [isDatasetPickerOpen, setIsDatasetPickerOpen] = useState(false)
  const [debugQuery, setDebugQuery] = useState('')
  const [debugRunError, setDebugRunError] = useState('')
  const [isOutputVarsExpanded, setIsOutputVarsExpanded] = useState(false)
  const appId = useWorkflowAppId()
  const lastRun = resolveNodeLastRun(id, nodeData)
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
    setIsDatasetPickerOpen(true)
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

  const { runDebug, isRunning: isDebugRunning, error: debugApiError, clearError } = useNodeDebugRun({
    appId,
    nodeId: id,
    nodeKind: 'knowledge',
    nodeInputs: config as unknown as Record<string, unknown>,
    debugInputs: debugQuery.trim() ? { query: debugQuery.trim() } : undefined,
  })

  const handleRunDebugQuery = useCallback(() => {
    const nextQuery = debugQuery.trim()
    if (!nextQuery) {
      setDebugRunError('请输入调试查询内容。')
      return
    }

    if (!config.dataset_ids.length) {
      setDebugRunError('请先至少选择一个知识库。')
      return
    }

    setDebugRunError('')
    clearError()
    void runDebug()
  }, [clearError, config.dataset_ids.length, debugQuery, runDebug])

  useRegisterPanelNodeDebug(id, {
    runDebug: handleRunDebugQuery,
    isRunning: isDebugRunning,
    disabled: !config.dataset_ids.length,
  })

  useEffect(() => {
    if (debugApiError) {
      setDebugRunError(debugApiError)
    }
  }, [debugApiError])

  return (
    <div className="space-y-3">
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
                {lastRun?.finishedAt
                  ? `最近一次调试：${formatDatasetUpdatedAt(lastRun.finishedAt)}`
                  : '还没有调试记录'}
              </p>
              <PanelRunDebugButton
                isRunning={isDebugRunning}
                disabled={isDatasetLoading}
                onClick={() => void handleRunDebugQuery()}
                runningLabel="检索中…"
                className="rounded-lg border border-blue-300 bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                运行检索
              </PanelRunDebugButton>
            </div>

            {debugRunError ? (
              <PanelAlert type="warning">{debugRunError}</PanelAlert>
            ) : null}

            {lastRun ? (
              <div className="space-y-2">
                <PanelLastRunKnowledgeDetails lastRun={lastRun} />
                <PanelLastRun lastRun={lastRun} />
              </div>
            ) : null}
          </div>
        </PanelCard>
      ) : null}

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
            required
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

          <KnowledgeDatasetPickerDialog
            open={isDatasetPickerOpen}
            onOpenChange={setIsDatasetPickerOpen}
            committedDatasetIds={config.dataset_ids}
            datasets={datasets}
            isLoading={isDatasetLoading}
            errorMessage={datasetErrorMessage}
            onRefresh={() => void refreshDatasets()}
            onConfirm={handleDatasetIdsChange}
          />
        </>
      ) : null}
    </div>
  )
}

export default React.memo(KnowledgeRetrievalPanel)
