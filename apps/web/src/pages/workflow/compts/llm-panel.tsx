import React, { useEffect, useMemo, useState } from 'react';
import InfoTooltip from '../base/info-tooltip';
import VariableSelect from '../base/variable-select';
import ExpandCollapseButton from '../base/expand-collapse-button';
import PanelAlert from '../base/panel-alert';
import AddItemButton from '../base/add-item-button';
import JSONSchemaInput from '../base/json-schema-input';
import { useEdges, useNodes, useReactFlow } from 'reactflow';
import type { PanelProps as NodePanelProps } from './custom-node';
import Field from '../base/field';
import {
  PanelCard,
  PanelChoiceGroup,
  PanelFieldRenderer,
  PanelInput,
  PanelOutputVarRow,
  PanelSection,
  PanelTextarea,
  PanelToggle,
  PanelToken,
} from '../base/panel-form';
import { COMPLETION_PARAM_DEFINITIONS } from '../features/llm-panel/catalog';
import type { Edge } from '../types/common';
import type { CanvasNodeData } from '../types/canvas';
import { useLLMPanelConfig } from '../features/llm-panel/use-llm-panel-config';
import { buildWorkflowVariableOptions } from '../utils/variable-options';
import { buildLLMNodeOutputs, buildLLMOutputTypes } from '../features/llm-panel/schema';
import type {
  ChatPromptItem,
  CompletionPromptItem,
  LLMNodeConfig,
  StructuredOutputConfig,
} from '../features/llm-panel/types';
import type { PanelFieldControl } from '../base/panel-form';



const PROMPT_ROLE_OPTIONS: Array<{ label: string; value: ChatPromptItem['role'] }> = [
  { label: 'SYSTEM', value: 'system' },
  { label: 'USER', value: 'user' },
  { label: 'ASSISTANT', value: 'assistant' },
];

const VISION_DETAIL_OPTIONS: Array<{ label: string; value: 'high' | 'low' | 'auto' }> = [
  { label: '高', value: 'high' },
  { label: '低', value: 'low' },
  { label: '自动', value: 'auto' },
];

type NumberSliderFieldConfig = Extract<PanelFieldControl, { controlType: 'numberSlider' }>;

const normalizeStructuredSchema = (
  parsed: Record<string, unknown>,
): StructuredOutputConfig['schema'] => {
  const properties =
    typeof parsed.properties === 'object' && parsed.properties !== null
      ? (parsed.properties as StructuredOutputConfig['schema']['properties'])
      : {};

  const required = Array.isArray(parsed.required)
    ? parsed.required.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
};

const PromptMessageEditor = ({
  item,
  index,
  canDelete,
  onChange,
  onDelete,
}: {
  item: ChatPromptItem;
  index: number;
  canDelete: boolean;
  onChange: (index: number, patch: Partial<ChatPromptItem>) => void;
  onDelete: (index: number) => void;
}) => {
  return (
    <PanelCard className="p-2">
      <div className="mb-1.5 flex items-center gap-2">
        <PanelChoiceGroup
          className="w-[220px]"
          size="sm"
          value={item.role}
          options={PROMPT_ROLE_OPTIONS}
          onChange={(value) => onChange(index, { role: value })}
        />
        <button
          type="button"
          disabled={!canDelete}
          onClick={() => onDelete(index)}
          className="ml-auto rounded-lg border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          删除
        </button>
      </div>
      <PanelTextarea
        className="min-h-[72px] px-2 py-1.5 text-[12px] leading-5"
        value={item.text}
        placeholder="在这里写你的提示词，输入 '/' 插入提示内容块"
        onChange={(event) => onChange(index, { text: event.target.value })}
      />
    </PanelCard>
  );
};

const CompletionPromptEditor = ({
  prompt,
  onChange,
}: {
  prompt: CompletionPromptItem;
  onChange: (patch: Partial<CompletionPromptItem>) => void;
}) => {
  return (
    <PanelCard className="p-2">
      <PanelTextarea
        className="min-h-[72px] px-2 py-1.5 text-[12px] leading-5"
        value={prompt.text}
        placeholder="输入 Completion Prompt"
        onChange={(event) => onChange({ text: event.target.value })}
      />
    </PanelCard>
  );
};


const LLMPanel = ({ id, data }: NodePanelProps) => {
  const { setNodes } = useReactFlow<CanvasNodeData, Edge>();
  const nodes = useNodes<CanvasNodeData>();
  const edges = useEdges<Edge>();
  const nodeData = data as CanvasNodeData;
  const availableVariables = buildWorkflowVariableOptions(
    id,
    nodes.map((node) => ({ id: node.id, data: node.data, parentId: node.parentId })),
    edges,
  );
  const {
    config,
    issues,
    modelOptions,
    lastMigrationNote,
    isChatModel,
    isCompletionModel,
    isVisionEnabledModel,
    isStructuredOutputEnabledModel,
    fileVariables,
    handleCompletionParamChange,
    handleContextEnabledChange,
    handleContextVariableChange,
    handlePromptItemChange,
    handleCompletionPromptChange,
    handleAddPromptMessage,
    handleRemovePromptMessage,
    handleToggleMemory,
    handleMemoryWindowEnabledChange,
    handleMemoryWindowSizeChange,
    handleMemoryQueryChange,
    handleRolePrefixChange,
    handleVisionEnabledChange,
    handleVisionVariableChange,
    handleVisionDetailChange,
    handleReasoningFormatChange,
    handleStructuredOutputEnabledChange,
    handleStructuredOutputChange,
  } = useLLMPanelConfig({
    value: nodeData.inputs,
    availableVariables,
    onChange: (nextValue: LLMNodeConfig) => {
      const nextOutputs = buildLLMNodeOutputs(nextValue);
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  inputs: {
                    ...nextValue,
                    _outputTypes: buildLLMOutputTypes(nextValue),
                  },
                  outputs: nextOutputs,
                },
              }
            : node,
        ),
      );
    },
  });
  const [isModelParamsExpanded, setIsModelParamsExpanded] = useState(false);
  const [schemaText, setSchemaText] = useState(() =>
    JSON.stringify(config.structuredOutput?.schema ?? null, null, 2),
  );
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => {
    setSchemaText(JSON.stringify(config.structuredOutput?.schema ?? null, null, 2));
  }, [config.structuredOutput]);

  useEffect(() => {
    const raw = JSON.stringify(nodeData.inputs ?? null);
    const normalized = JSON.stringify({
      ...config,
      _outputTypes: buildLLMOutputTypes(config),
    });
    const rawOutputs = JSON.stringify(nodeData.outputs ?? null);
    const normalizedOutputs = JSON.stringify(buildLLMNodeOutputs(config));

    if (raw !== normalized || rawOutputs !== normalizedOutputs) {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  inputs: {
                    ...config,
                    _outputTypes: buildLLMOutputTypes(config),
                  },
                  outputs: buildLLMNodeOutputs(config),
                },
              }
            : node,
        ),
      );
    }
  }, [config, id, nodeData.inputs, nodeData.outputs, setNodes]);

  const promptHasContextBlock = useMemo(() => {
    if (Array.isArray(config.promptTemplate)) {
      return config.promptTemplate.some(
        (item) => item.text.includes('{{context}}') || item.text.includes('{{#context#}}'),
      );
    }

    const prompt = config.promptTemplate as CompletionPromptItem;
    const content = prompt.text;
    return content.includes('{{context}}') || content.includes('{{#context#}}');
  }, [config.promptTemplate]);

  const virtualModel = modelOptions[0];
  const parameterFields: NumberSliderFieldConfig[] = COMPLETION_PARAM_DEFINITIONS.map((param) => {
    const rawValue = config.model.completionParams[param.key];
    const currentValue = typeof rawValue === 'number' ? rawValue : param.defaultValue;

    return {
      controlType: 'numberSlider',
      value: currentValue,
      min: param.min,
      max: param.max,
      step: param.step,
      inputMin: param.inputMin,
      inputMax: param.inputMax,
      onChange: (value) => handleCompletionParamChange(param.key, value),
    };
  });
  const memoryWindowField: NumberSliderFieldConfig = {
    controlType: 'numberSlider',
    min: 1,
    max: 100,
    step: 1,
    disabled: !config.memory?.window.enabled,
    value: config.memory?.window.size ?? 50,
    onChange: handleMemoryWindowSizeChange,
  };

  return (
    <div className="space-y-3 pb-2">
      {issues.length ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">当前配置存在待处理项</p>
          <ul className="mt-1.5 space-y-1 text-[11px] leading-4 text-amber-800">
            {issues.map((issue) => (
              <li key={`${issue.path}-${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {lastMigrationNote ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-2.5 text-[11px] leading-4 text-blue-700">
          {lastMigrationNote}
        </section>
      ) : null}

      <PanelSection title="模型" required>
        <PanelCard className="space-y-2.5 px-4 py-3.5 rounded-xl border border-slate-200/60 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <p className="text-[12px] font-semibold text-slate-700">
                {virtualModel?.label ?? '智灵'}
              </p>
              <InfoTooltip content="虚拟 LLM 默认由后端接入层决定" />
            </div>
            <ExpandCollapseButton
              expanded={isModelParamsExpanded}
              onClick={() => setIsModelParamsExpanded((v) => !v)}
              labelExpand="修改参数"
              labelCollapse="收起参数"
            />
          </div>

          {/* <div className="flex flex-wrap gap-1.5">
            {COMPLETION_PARAM_DEFINITIONS.map((param, index) => {
              const field = parameterFields[index];
              return (
                <PanelToken
                  key={param.key}
                  className="border-slate-200 bg-slate-50 text-slate-700 text-[11px] rounded-lg px-2 py-0.75"
                >
                  {param.label}: {field.value}
                </PanelToken>
              );
            })}
          </div> */}

          {isModelParamsExpanded && (
            <div className="space-y-2 border-t border-slate-200/50 pt-2.5">
              {COMPLETION_PARAM_DEFINITIONS.map((param, index) => (
                <div
                  key={param.key}
                  className="grid gap-2 rounded-lg bg-slate-50/80 px-3 py-2 md:grid-cols-[140px_minmax(0,1fr)] md:items-center"
                >
                  <div>
                    <p className="text-[11px] font-semibold text-slate-700">{param.label}</p>
                    <p className="mt-0.5 text-[10px] leading-tight text-slate-500">
                      {param.description}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <PanelFieldRenderer field={parameterFields[index]} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      </PanelSection>

      <PanelSection title="上下文">
        <PanelCard className="flex items-center justify-between gap-3 px-2.5 py-2">
          <div>
            <p className="text-[12px] font-medium text-slate-700">设置变量值</p>
            <p className="text-[10px] text-slate-500">从系统变量或上游节点输出中选择。</p>
          </div>
          <PanelToggle checked={config.context.enabled} onChange={handleContextEnabledChange} />
        </PanelCard>
        <VariableSelect
          value={config.context.variableSelector}
          options={availableVariables}
          onChange={handleContextVariableChange}
          placeholder="设置变量值"
        />
        {config.context.enabled && !promptHasContextBlock ? (
          <PanelAlert type="warning">
            已启用 Context，但 Prompt 中尚未检测到 context block，可在 Prompt 中插入 {'{{context}}'} 或 {'{{#context#}}'}。
          </PanelAlert>
        ) : null}
      </PanelSection>

      {config.model.name ? (
        <PanelSection title="Prompt" required>
          {isChatModel ? (
            <>
              <div className="space-y-2.5">
                {(config.promptTemplate as ChatPromptItem[]).map((item, index, items) => (
                  <PromptMessageEditor
                    key={item.id}
                    item={item}
                    index={index}
                    canDelete={items.length > 1}
                    onChange={handlePromptItemChange}
                    onDelete={handleRemovePromptMessage}
                  />
                ))}
              </div>
              <AddItemButton onClick={handleAddPromptMessage}>+ 添加消息</AddItemButton>
            </>
          ) : (
            <CompletionPromptEditor
              prompt={config.promptTemplate as CompletionPromptItem}
              onChange={handleCompletionPromptChange}
            />
          )}
        </PanelSection>
      ) : null}

      <PanelSection
        title="记忆"
        aside={
          <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[10px] font-medium leading-4 text-[#4f6fff]">
            内置
          </span>
        }
      >
        <PanelCard className="flex items-center justify-between gap-3 px-2.5 py-2">
          <div>
            <p className="text-[12px] font-medium text-slate-700">启用记忆</p>
            <p className="text-[10px] text-slate-500">用于拼接多轮对话和用户输入。</p>
          </div>
          <PanelToggle checked={!!config.memory} onChange={handleToggleMemory} />
        </PanelCard>
        {config.memory ? (
          <>
            <PanelCard className="p-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-700">
                    USER
                  </p>
                  <p className="mt-1.5 flex flex-wrap gap-1.5">
                    <PanelToken>用户输入 / query</PanelToken>
                    <PanelToken>用户输入 / files</PanelToken>
                  </p>
                </div>
              </div>
            </PanelCard>
            <PanelCard className="flex items-center justify-between gap-4 px-2.5 py-2">
              <div>
                <p className="text-[12px] font-medium text-slate-700">记忆窗口</p>
                <p className="text-[10px] text-slate-500">控制拼接多少轮历史对话。</p>
              </div>
              <PanelToggle
                checked={config.memory.window.enabled}
                onChange={handleMemoryWindowEnabledChange}
              />
            </PanelCard>
            <PanelFieldRenderer field={memoryWindowField} />
            <Field title="User Query Prompt" compact>
              <div className="space-y-1">
                <PanelTextarea
                  className="min-h-[76px] text-[12px] leading-5"
                  value={config.memory.queryPromptTemplate}
                  onChange={(event) => handleMemoryQueryChange(event.target.value)}
                />
                <p className="text-[10px] leading-4 text-slate-500">
                  Chat 模式下必须包含 {'{{#sys.query#}}'}。
                </p>
              </div>
            </Field>
            {isCompletionModel ? (
              <div className="grid grid-cols-2 gap-3">
                <Field title="User Prefix" compact>
                  <PanelInput
                    className="text-[12px]"
                    value={config.memory.rolePrefix?.user ?? ''}
                    onChange={(event) => handleRolePrefixChange('user', event.target.value)}
                  />
                </Field>
                <Field title="Assistant Prefix" compact>
                  <PanelInput
                    className="text-[12px]"
                    value={config.memory.rolePrefix?.assistant ?? ''}
                    onChange={(event) => handleRolePrefixChange('assistant', event.target.value)}
                  />
                </Field>
              </div>
            ) : null}
          </>
        ) : null}
      </PanelSection>

      <PanelSection
        title="视觉"
        aside={
          <PanelToggle
            checked={config.vision.enabled}
            onChange={handleVisionEnabledChange}
            disabled={!isVisionEnabledModel}
          />
        }
      >
        {!isVisionEnabledModel ? (
          <p className="text-[10px] leading-4 text-slate-500">当前模型不支持 vision feature。</p>
        ) : null}
        {config.vision.enabled ? (
          <>
            <VariableSelect
              value={config.vision.configs?.variableSelector ?? []}
              options={fileVariables}
              onChange={handleVisionVariableChange}
              placeholder="选择文件变量"
            />
            <Field title="分辨率" compact>
              <PanelChoiceGroup
                size="sm"
                value={config.vision.configs?.detail ?? 'high'}
                options={VISION_DETAIL_OPTIONS}
                onChange={handleVisionDetailChange}
              />
            </Field>
          </>
        ) : null}
      </PanelSection>

      <PanelSection
        title="启用推理标签分离"
        aside={
          <PanelToggle
            checked={(config.reasoningFormat ?? 'tagged') === 'separated'}
            onChange={handleReasoningFormatChange}
          />
        }
      >
        <p className="text-[10px] leading-4 text-slate-500">
          开启后将推理内容独立输出到 reasoning_content。
        </p>
      </PanelSection>

      <PanelSection
        title="输出变量"
        aside={
          <PanelToggle
            checked={config.structuredOutputEnabled === true}
            onChange={handleStructuredOutputEnabledChange}
          />
        }
      >
        <div className="space-y-3">
          <PanelOutputVarRow name="text" type="string" description="生成内容" />
          <PanelOutputVarRow name="reasoning_content" type="string" description="推理内容" />
          <PanelOutputVarRow name="usage" type="object" description="模型用量信息" />
          {config.structuredOutputEnabled ? (
            <PanelOutputVarRow
              name="structured_output"
              type="object"
              description="结构化输出结果"
            />
          ) : null}
        </div>
        {config.structuredOutputEnabled && !isStructuredOutputEnabledModel ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-4 text-amber-800">
            当前模型没有声明 structured_output feature，这里采用软提醒，不强制拦截。
          </p>
        ) : null}
        {config.structuredOutputEnabled ? (
          <Field title="JSON Schema" compact>
            <JSONSchemaInput
              value={schemaText}
              onChange={(val) => {
                setSchemaText(val);
                setSchemaError(null);
              }}
              onBlur={(parsed, error) => {
                if (!error && parsed) {
                  handleStructuredOutputChange({
                    schema: normalizeStructuredSchema(parsed as Record<string, unknown>),
                  });
                  setSchemaError(null);
                } else {
                  setSchemaError(error);
                }
              }}
              error={schemaError}
            />
          </Field>
        ) : null}
      </PanelSection>
    </div>
  );
};

export default React.memo(LLMPanel);
