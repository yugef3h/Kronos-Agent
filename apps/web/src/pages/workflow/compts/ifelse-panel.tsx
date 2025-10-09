import React, { useEffect, useMemo, useState } from 'react';
import { useEdges, useNodes, useReactFlow, useUpdateNodeInternals } from 'reactflow';
import type { PanelProps as NodePanelProps } from './custom-node';
import VariableSelect from '../base/variable-select';
import {
  PanelCard,
  PanelChoiceGroup,
  PanelInput,
  PanelSection,
  PanelSelect,
} from '../base/panel-form';
import type { Edge } from '../types/common';
import type { CanvasNodeData } from '../types/canvas';
import type { VariableOption } from '../features/llm-panel/types';
import {
  buildIfElseTargetBranches,
  comparisonOperatorRequiresValue,
  getComparisonOperatorLabel,
  getComparisonOptionsByVariableType,
  getIfElseCaseLabel,
} from '../features/ifelse-panel/schema';
import { useIfElsePanelConfig } from '../features/ifelse-panel/use-ifelse-panel-config';
import type { IfElseCondition, IfElseNodeConfig } from '../features/ifelse-panel/types';
import { buildWorkflowVariableOptions } from '../utils/variable-options';

const serializeValueSelector = (valueSelector: string[]) => valueSelector.join('.');

const ConditionEditor = ({
  caseId,
  condition,
  variableOptions,
  autoOpenSignal,
  onVariableChange,
  onVariableSelectOpenChange,
  onOperatorChange,
  onValueChange,
  onRemove,
}: {
  caseId: string;
  condition: IfElseCondition;
  variableOptions: VariableOption[];
  autoOpenSignal?: string | null;
  onVariableChange: (caseId: string, conditionId: string, variable?: VariableOption) => void;
  onVariableSelectOpenChange?: (conditionId: string, isOpen: boolean) => void;
  onOperatorChange: (
    caseId: string,
    conditionId: string,
    value: IfElseCondition['comparisonOperator'],
  ) => void;
  onValueChange: (caseId: string, conditionId: string, value: IfElseCondition['value']) => void;
  onRemove: (caseId: string, conditionId: string) => void;
}) => {
  const operatorOptions = getComparisonOptionsByVariableType(condition.variableType);
  const requiresValue = comparisonOperatorRequiresValue(condition.comparisonOperator);

  return (
    <PanelCard className="relative space-y-2 border-[#e7edf7] bg-[#f6f8fc] p-[1px] shadow-none">
      <div className="grid grid-cols-[minmax(0,1fr)_80px_auto] gap-2">
        <VariableSelect
          value={condition.variableSelector}
          options={variableOptions}
          placeholder="选择上游变量"
          openSignal={autoOpenSignal ?? null}
          onOpenChange={(isOpen) => onVariableSelectOpenChange?.(condition.id, isOpen)}
          onChange={(valueSelector) => {
            const nextVariable = variableOptions.find(
              (option) =>
                serializeValueSelector(option.valueSelector) ===
                serializeValueSelector(valueSelector),
            );
            onVariableChange(caseId, condition.id, nextVariable);
          }}
        />

        <PanelSelect
          value={condition.comparisonOperator}
          className="bg-white"
          onChange={(event) =>
            onOperatorChange(
              caseId,
              condition.id,
              event.target.value as IfElseCondition['comparisonOperator'],
            )
          }
        >
          {operatorOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </PanelSelect>

        <button
          type="button"
          aria-label="删除条件"
          onClick={() => onRemove(caseId, condition.id)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#e3e8f2] bg-white text-slate-400 transition hover:border-rose-200 hover:text-rose-600"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M2.9165 4.08334H11.0832"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M5.24984 1.75H8.74984"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M10.4998 4.08334V10.5C10.4998 11.1443 9.9775 11.6667 9.33317 11.6667H4.6665C4.02217 11.6667 3.49984 11.1443 3.49984 10.5V4.08334"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M5.8335 6.41666V9.33333"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M8.1665 6.41666V9.33333"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {requiresValue ? (
        condition.variableType === 'boolean' ? (
          <PanelChoiceGroup
            size="sm"
            className="w-[160px]"
            value={String(condition.value === true)}
            options={[
              { label: 'TRUE', value: 'true' },
              { label: 'FALSE', value: 'false' },
            ]}
            onChange={(value) => onValueChange(caseId, condition.id, value === 'true')}
          />
        ) : (
          <PanelInput
            type={condition.variableType === 'number' ? 'number' : 'text'}
            placeholder="输入值"
            className="bg-white !mt-[1px]"
            value={
              typeof condition.value === 'boolean'
                ? String(condition.value)
                : (condition.value ?? '')
            }
            onChange={(event) => {
              const nextValue =
                condition.variableType === 'number'
                  ? event.target.value === ''
                    ? ''
                    : Number(event.target.value)
                  : event.target.value;

              onValueChange(caseId, condition.id, nextValue === '' ? '' : nextValue);
            }}
          />
        )
      ) : (
        <div className="flex h-8 items-center rounded-[10px] border border-dashed border-slate-200 bg-white px-2.5 text-[11px] text-slate-500">
          {getComparisonOperatorLabel(condition.comparisonOperator)} 无需输入值
        </div>
      )}
    </PanelCard>
  );
};

const IfElsePanel = ({ id, data }: NodePanelProps) => {
  const { setNodes, setEdges } = useReactFlow<CanvasNodeData, Edge>();
  const nodes = useNodes<CanvasNodeData>();
  const edges = useEdges<Edge>();
  const updateNodeInternals = useUpdateNodeInternals();
  const nodeData = data as CanvasNodeData;
  const variableOptions = useMemo(
    () =>
      buildWorkflowVariableOptions(
        id,
        nodes.map((node) => ({ id: node.id, data: node.data, parentId: node.parentId })),
        edges,
      ),
    [edges, id, nodes],
  );
  const [activeTab, setActiveTab] = useState<'settings' | 'last-run'>('settings');
  const [pendingAutoOpenConditionId, setPendingAutoOpenConditionId] = useState<string | null>(null);
  const {
    config,
    handleAddCase,
    handleRemoveCase,
    handleCaseLogicalOperatorChange,
    handleAddCondition,
    handleRemoveCondition,
    handleConditionVariableChange,
    handleConditionOperatorChange,
    handleConditionValueChange,
  } = useIfElsePanelConfig({
    value: nodeData.inputs,
    onChange: (nextValue: IfElseNodeConfig) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== id) return node;

          return {
            ...node,
            data: {
              ...node.data,
              inputs: nextValue as unknown as Record<string, unknown>,
              _targetBranches: buildIfElseTargetBranches(nextValue.cases),
            },
          };
        }),
      );
    },
  });
  const targetBranches = buildIfElseTargetBranches(config.cases);

  useEffect(() => {
    const rawInputs = JSON.stringify(nodeData.inputs ?? null);
    const normalizedInputs = JSON.stringify(config);
    const rawBranches = JSON.stringify(nodeData._targetBranches ?? []);
    const normalizedBranches = JSON.stringify(targetBranches);

    if (rawInputs !== normalizedInputs || rawBranches !== normalizedBranches) {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== id) return node;

          return {
            ...node,
            data: {
              ...node.data,
              inputs: config as unknown as Record<string, unknown>,
              _targetBranches: targetBranches,
            },
          };
        }),
      );
    }
  }, [config, id, nodeData._targetBranches, nodeData.inputs, setNodes, targetBranches]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, targetBranches.length, updateNodeInternals]);

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
              运行工作流后，这里会显示条件命中的分支、输入变量和结果，便于排查 if / elif / else
              的走向。
            </p>
          </PanelCard>
        ) : null}
      </div>

      {activeTab === 'settings' ? (
        <>
          {config.cases.map((caseItem, index) => (
            <PanelSection
              key={caseItem.case_id}
              aside={
                <div className="flex items-center gap-1.5">
                  {index > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleRemoveCase(caseItem.case_id);
                        setEdges((edges) =>
                          edges.filter(
                            (edge) =>
                              !(edge.source === id && edge.sourceHandle === caseItem.case_id),
                          ),
                        );
                      }}
                      className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:border-rose-200 hover:text-rose-600"
                    >
                      删除
                    </button>
                  ) : null}
                </div>
              }
            >
              <div className="relative pl-12">
                <div className="absolute left-0 top-[5px] text-[13px] font-bold text-slate-900">
                  {getIfElseCaseLabel(index)}
                </div>
{/* absolute bottom-4 left-[46px] top-4 w-2.5 rounded-l-[8px] border border-r-0 border-divider-deep */}
                <div className="relative">
                  {caseItem.conditions.length > 1 && (
                    <div className="absolute left-[-26px] rounded-l-[8px] top-[18px] border border-r-0 bottom-[18px] w-5 border-divider-deep">
                      <div className="absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                        <button
                          type="button"
                          onClick={() =>
                            handleCaseLogicalOperatorChange(
                              caseItem.case_id,
                              caseItem.logical_operator === 'and' ? 'or' : 'and',
                            )
                          }
                          className="inline-flex min-w-[34px] items-center justify-center gap-0.5 rounded-full border border-[#d7e2ff] bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#2f66ff] shadow-sm transition hover:border-[#b8cbff] hover:text-[#244fda]"
                        >
                          {caseItem.logical_operator.toUpperCase()}
                          <svg
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            fill="currentColor"
                            className="remixicon ml-0.5 h-3 w-3"
                          >
                            <path d="M12 4C9.25144 4 6.82508 5.38626 5.38443 7.5H8V9.5H2V3.5H4V5.99936C5.82381 3.57166 8.72764 2 12 2C17.5228 2 22 6.47715 22 12H20C20 7.58172 16.4183 4 12 4ZM4 12C4 16.4183 7.58172 20 12 20C14.7486 20 17.1749 18.6137 18.6156 16.5H16V14.5H22V20.5H20V18.0006C18.1762 20.4283 15.2724 22 12 22C6.47715 22 2 17.5228 2 12H4Z"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {caseItem.conditions.map((condition) => (
                      <div key={condition.id} className="relative">

                        <ConditionEditor
                          caseId={caseItem.case_id}
                          condition={condition}
                          variableOptions={variableOptions}
                          autoOpenSignal={
                            pendingAutoOpenConditionId === condition.id ? condition.id : null
                          }
                          onVariableChange={handleConditionVariableChange}
                          onVariableSelectOpenChange={(conditionId, isOpen) => {
                            if (!isOpen && pendingAutoOpenConditionId === conditionId) {
                              setPendingAutoOpenConditionId(null);
                            }
                          }}
                          onOperatorChange={handleConditionOperatorChange}
                          onValueChange={handleConditionValueChange}
                          onRemove={handleRemoveCondition}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const nextConditionId = handleAddCondition(caseItem.case_id);
                      if (nextConditionId) {
                        setPendingAutoOpenConditionId(nextConditionId);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#dbe4f4] bg-white px-3 py-1 text-[12px] font-semibold text-slate-700 transition hover:border-[#b8cbff] hover:text-[#2f66ff]"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M7 2.91666V11.0833"
                        stroke="currentColor"
                        strokeWidth="1.35"
                        strokeLinecap="round"
                      />
                      <path
                        d="M2.9165 7H11.0832"
                        stroke="currentColor"
                        strokeWidth="1.35"
                        strokeLinecap="round"
                      />
                    </svg>
                    添加条件
                  </button>
                </div>
              </div>
            </PanelSection>
          ))}

          <div className="border-b border-slate-100 py-2">
            <button
              type="button"
              onClick={handleAddCase}
              className="flex font-semibold w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#e3e8f1] bg-[#f5f7fb] px-3 py-1 text-[12px] text-slate-700 transition hover:border-[#b8cbff] hover:bg-[#eef4ff] hover:text-[#2f66ff]"
            >
              <span className="text-[16px] leading-none">+</span>
              ELIF
            </button>
          </div>

          <PanelSection title="ELSE">
            <p className="text-[12px] leading-5 text-slate-600">
              用于定义当 if 条件不满足时应执行的逻辑。
            </p>
          </PanelSection>
        </>
      ) : null}
    </div>
  );
};

export default React.memo(IfElsePanel);
