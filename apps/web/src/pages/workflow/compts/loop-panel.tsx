import React, { useEffect, useMemo, useState } from 'react';
import { useEdges, useNodes, useReactFlow } from 'reactflow';
import type { PanelProps as NodePanelProps } from './custom-node';
import VariableSelect from '../base/variable-select';
import Field from '../base/field';
import {
  PanelCard,
  PanelChoiceGroup,
  PanelInput,
  PanelSection,
  PanelSelect,
  PanelSliderInput,
  PanelToken,
} from '../base/panel-form';
import type { Edge } from '../types/common';
import type { CanvasNodeData } from '../types/canvas';
import type { VariableOption } from '../features/llm-panel/types';
import { buildWorkflowVariableOptions, serializeValueSelector } from '../utils/variable-options';
import {
  comparisonOperatorRequiresValue,
  getComparisonOperatorLabel,
  getComparisonOptionsByVariableType,
  getLoopVariableTypeLabel,
} from '../features/loop-panel/schema';
import { useLoopPanelConfig } from '../features/loop-panel/use-loop-panel-config';
import type {
  LoopBreakCondition,
  LoopNodeConfig,
  LoopVariable,
} from '../features/loop-panel/types';
import InfoTooltip from '../base/info-tooltip';

const findVariableOption = (valueSelector: string[], options: VariableOption[]) => {
  const serialized = serializeValueSelector(valueSelector);
  return options.find((option) => serializeValueSelector(option.valueSelector) === serialized);
};

const LoopConditionEditor = ({
  condition,
  variableOptions,
  onVariableChange,
  onOperatorChange,
  onValueChange,
  onRemove,
}: {
  condition: LoopBreakCondition;
  variableOptions: VariableOption[];
  onVariableChange: (conditionId: string, variable?: VariableOption) => void;
  onOperatorChange: (conditionId: string, value: LoopBreakCondition['comparisonOperator']) => void;
  onValueChange: (conditionId: string, value: LoopBreakCondition['value']) => void;
  onRemove: (conditionId: string) => void;
}) => {
  const operatorOptions = getComparisonOptionsByVariableType(condition.variableType);
  const requiresValue = comparisonOperatorRequiresValue(condition.comparisonOperator);

  return (
    <PanelCard className="space-y-2.5 border-[#e8edf5] bg-white p-[2px] shadow-none">
      <div className="flex items-center gap-1.5">
        <PanelToken>{condition.variableType}</PanelToken>
        <button
          type="button"
          onClick={() => onRemove(condition.id)}
          className="ml-auto rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition text-red-500 hover:border-rose-200"
        >
          删除
        </button>
      </div>

      <div className="grid gap-1.5 md:grid-cols-[minmax(0,1.9fr)_80px_minmax(0,0.95fr)] !mt-[2px]">
        <VariableSelect
          value={condition.variableSelector}
          options={variableOptions}
          placeholder="选择变量"
          onChange={(valueSelector) =>
            onVariableChange(condition.id, findVariableOption(valueSelector, variableOptions))
          }
        />

        <PanelSelect
          value={condition.comparisonOperator}
          onChange={(event) =>
            onOperatorChange(
              condition.id,
              event.target.value as LoopBreakCondition['comparisonOperator'],
            )
          }
        >
          {operatorOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </PanelSelect>

        {requiresValue ? (
          condition.variableType === 'boolean' ? (
            <PanelChoiceGroup
              size="sm"
              value={String(condition.value === true)}
              options={[
                { label: 'TRUE', value: 'true' },
                { label: 'FALSE', value: 'false' },
              ]}
              onChange={(value) => onValueChange(condition.id, value === 'true')}
            />
          ) : (
            <PanelInput
              type={condition.variableType === 'number' ? 'number' : 'text'}
              placeholder="比较值"
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

                onValueChange(condition.id, nextValue === '' ? '' : nextValue);
              }}
            />
          )
        ) : (
          <div className="flex items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500">
            {getComparisonOperatorLabel(condition.comparisonOperator)} 无需比较值
          </div>
        )}
      </div>
    </PanelCard>
  );
};

const LoopVariableEditor = ({
  loopVariable,
  variableOptions,
  onChange,
  onRemove,
}: {
  loopVariable: LoopVariable;
  variableOptions: VariableOption[];
  onChange: (patch: Partial<LoopVariable>) => void;
  onRemove: () => void;
}) => {
  return (
    <PanelCard className="space-y-2.5 border-[#e8edf5] bg-white p-2.5 shadow-none">
      <div className="flex items-center gap-1.5">
        <PanelToken>{getLoopVariableTypeLabel(loopVariable.var_type)}</PanelToken>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition hover:border-rose-200 hover:text-rose-600"
        >
          删除
        </button>
      </div>

      <div className="grid gap-1.5 md:grid-cols-[minmax(0,1.2fr)_110px_110px]">
        <PanelInput
          value={loopVariable.label}
          placeholder="变量名"
          onChange={(event) => onChange({ label: event.target.value })}
        />

        <PanelSelect
          value={loopVariable.var_type}
          onChange={(event) =>
            onChange({ var_type: event.target.value as LoopVariable['var_type'] })
          }
        >
          <option value="string">String</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option value="array">Array</option>
          <option value="object">Object</option>
        </PanelSelect>

        <PanelChoiceGroup
          size="sm"
          value={loopVariable.value_type}
          options={[
            { label: '常量', value: 'constant' },
            { label: '变量', value: 'variable' },
          ]}
          onChange={(value) => onChange({ value_type: value as LoopVariable['value_type'] })}
        />
      </div>

      {loopVariable.value_type === 'variable' ? (
        <Field title="变量来源" compact>
          <VariableSelect
            value={loopVariable.value_selector}
            options={variableOptions}
            placeholder="选择变量"
            onChange={(valueSelector) => onChange({ value_selector: valueSelector })}
          />
        </Field>
      ) : loopVariable.var_type === 'boolean' ? (
        <Field title="常量值" compact>
          <PanelChoiceGroup
            size="sm"
            value={String(loopVariable.value === true)}
            options={[
              { label: 'TRUE', value: 'true' },
              { label: 'FALSE', value: 'false' },
            ]}
            onChange={(value) => onChange({ value: value === 'true' })}
          />
        </Field>
      ) : (
        <Field title="" compact>
          <PanelInput
            type={loopVariable.var_type === 'number' ? 'number' : 'text'}
            value={
              typeof loopVariable.value === 'boolean'
                ? String(loopVariable.value)
                : loopVariable.value
            }
            placeholder="输入初始默认值"
            onChange={(event) => {
              const nextValue =
                loopVariable.var_type === 'number'
                  ? event.target.value === ''
                    ? 0
                    : Number(event.target.value)
                  : event.target.value;

              onChange({ value: nextValue });
            }}
          />
        </Field>
      )}
    </PanelCard>
  );
};

const LoopPanel = ({ id, data }: NodePanelProps) => {
  const { setNodes } = useReactFlow<CanvasNodeData, Edge>();
  const nodes = useNodes<CanvasNodeData>();
  const edges = useEdges<Edge>();
  const nodeData = data as CanvasNodeData;
  const [activeTab, setActiveTab] = useState<'settings' | 'last-run'>('settings');

  const variableOptions = useMemo(
    () =>
      buildWorkflowVariableOptions(
        id,
        nodes.map((node) => ({ id: node.id, data: node.data, parentId: node.parentId })),
        edges,
      ),
    [edges, id, nodes],
  );

  const {
    config,
    // issues,
    handleAddLoopVariable,
    handleRemoveLoopVariable,
    handleUpdateLoopVariable,
    handleLogicalOperatorChange,
    handleLoopCountChange,
    handleAddBreakCondition,
    handleRemoveBreakCondition,
    handleConditionVariableChange,
    handleConditionOperatorChange,
    handleConditionValueChange,
  } = useLoopPanelConfig({
    nodeId: id,
    value: nodeData.inputs,
    onChange: (nextValue: LoopNodeConfig) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== id) return node;

          return {
            ...node,
            data: {
              ...node.data,
              inputs: nextValue as unknown as Record<string, unknown>,
              outputs: {
                steps: [],
                count: 0,
                ...(node.data.outputs ?? {}),
              },
            },
          };
        }),
      );
    },
  });

  const loopVariableOptions = useMemo<VariableOption[]>(() => {
    return config.loop_variables
      .filter((loopVariable) => loopVariable.label.trim())
      .map((loopVariable) => ({
        label: `loop.${loopVariable.label.trim()}`,
        valueSelector: [id, loopVariable.label.trim()],
        valueType: loopVariable.var_type,
        source: 'node',
      }));
  }, [config.loop_variables, id]);

  const breakConditionOptions = useMemo(
    () => [...loopVariableOptions, ...variableOptions],
    [loopVariableOptions, variableOptions],
  );

  useEffect(() => {
    const rawInputs = JSON.stringify(nodeData.inputs ?? null);
    const normalizedInputs = JSON.stringify(config);
    const outputs = nodeData.outputs ?? {};
    const hasOutputShape = 'steps' in outputs && 'count' in outputs;

    if (rawInputs !== normalizedInputs || !hasOutputShape) {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== id) return node;

          return {
            ...node,
            data: {
              ...node.data,
              inputs: config as unknown as Record<string, unknown>,
              outputs: {
                steps: [],
                count: 0,
                ...(node.data.outputs ?? {}),
              },
            },
          };
        }),
      );
    }
  }, [config, id, nodeData.inputs, nodeData.outputs, setNodes]);

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
              运行工作流后，这里会展示循环次数、命中的 break 条件和每轮上下文变量快照。
            </p>
          </PanelCard>
        ) : null}
      </div>

      {activeTab === 'settings' ? (
        <>
          {/* <PanelSection title="容器入口">
            {issues.length ? <PanelAlert type="warning">{issues[0].message}</PanelAlert> : null}
          </PanelSection> */}

          <PanelSection
            title="循环变量"
            aside={
              <button
                type="button"
                onClick={handleAddLoopVariable}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white text-[15px] text-slate-600 transition hover:bg-[#c8ceda33]"
              >
                +
              </button>
            }
          >
            <PanelCard className="space-y-2 bg-white p-0 border-none shadow-none">
              {config.loop_variables.length ? (
                config.loop_variables.map((loopVariable) => (
                  <LoopVariableEditor
                    key={loopVariable.id}
                    loopVariable={loopVariable}
                    variableOptions={variableOptions}
                    onChange={(patch) => handleUpdateLoopVariable(loopVariable.id, patch)}
                    onRemove={() => handleRemoveLoopVariable(loopVariable.id)}
                  />
                ))
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-500">
                  在循环范围内设置变量
                </div>
              )}
            </PanelCard>
          </PanelSection>

          <PanelSection
            title={
              <>
                循环中断条件
                <span className="ml-1 flex items-center">
                  <InfoTooltip content="未配置 break condition 时，Loop 会按最大轮数跑完。配置后命中即可提前结束。" />
                </span>
              </>
            }
          >
            <PanelCard className="space-y-2.5 bg-white p-0 border-none shadow-none">

              {config.break_conditions.length ? (
                <div className="relative ml-12">
                  {config.break_conditions.length > 1 ? (
                    <div className="absolute left-[-26px] top-[18px] bottom-[18px] w-5 rounded-l-[8px] border border-r-0 border-divider-deep">
                      <div className="absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                        <button
                          type="button"
                          onClick={() =>
                            handleLogicalOperatorChange(
                              config.logical_operator === 'and' ? 'or' : 'and',
                            )
                          }
                          className="inline-flex min-w-[34px] items-center justify-center gap-0.5 rounded-full border border-[#d7e2ff] bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#2f66ff] shadow-sm transition hover:border-[#b8cbff] hover:text-[#244fda]"
                        >
                          {config.logical_operator.toUpperCase()}
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
                  ) : null}

                  <div className="space-y-2.5">
                    {config.break_conditions.map((condition) => (
                      <LoopConditionEditor
                        key={condition.id}
                        condition={condition}
                        variableOptions={breakConditionOptions}
                        onVariableChange={handleConditionVariableChange}
                        onOperatorChange={handleConditionOperatorChange}
                        onValueChange={handleConditionValueChange}
                        onRemove={handleRemoveBreakCondition}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() =>
                  handleAddBreakCondition(loopVariableOptions[0] ?? breakConditionOptions[0])
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-600"
              >
                <span className="text-sm leading-none">+</span>
                添加条件
              </button>
            </PanelCard>
          </PanelSection>

          <PanelSection title="循环上限">
            <PanelCard className="space-y-2.5 bg-white p-0 border-none shadow-none">
              <Field title="" compact>
                <PanelSliderInput
                  min={1}
                  max={100}
                  step={1}
                  value={config.loop_count}
                  onChange={handleLoopCountChange}
                />
              </Field>
              <p className="text-[11px] leading-5 text-slate-500">
                如果 break condition 未命中，Loop 会在第 {config.loop_count} 轮后强制结束。
              </p>
            </PanelCard>
          </PanelSection>
        </>
      ) : null}
    </div>
  );
};

export default React.memo(LoopPanel);
