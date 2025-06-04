import React, { useEffect, useMemo, useState } from 'react';
import { useReactFlow } from 'reactflow';
import type { PanelProps as NodePanelProps } from './custom-node';
import Field from '../base/field';
import {
  PanelCard,
  PanelChoiceGroup,
  PanelFieldRenderer,
  PanelInput,
  PanelOutputVarRow,
  PanelSection,
  PanelSelect,
  PanelTextarea,
  PanelToggle,
  PanelToken,
} from '../base/panel-form';
import { COMPLETION_PARAM_DEFINITIONS } from '../features/llm-panel/catalog';
import type { Edge } from '../types/common';
import type { CanvasNodeData } from '../types/canvas';
import { useLLMPanelConfig } from '../features/llm-panel/use-llm-panel-config';
import type {
  ChatPromptItem,
  CompletionPromptItem,
  LLMNodeConfig,
  StructuredOutputConfig,
  ValueSelector,
  VariableOption,
} from '../features/llm-panel/types';
import type { PanelFieldControl } from '../base/panel-form';

const serializeValueSelector = (valueSelector: ValueSelector): string => valueSelector.join('.');

const parseValueSelector = (value: string): ValueSelector => value.split('.').filter(Boolean);

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
  ];

  const nodeVariables = nodes
    .filter((node) => node.id !== currentNodeId)
    .sort((left, right) => left.data.title.localeCompare(right.data.title, 'zh-CN'))
    .flatMap((node) => {
      const outputs = Object.keys(node.data.outputs ?? {});
      if (!outputs.length) return [];

      return outputs.map<VariableOption>((outputKey) => ({
        label: `${node.data.title}.${outputKey}`,
        valueSelector: [node.id, outputKey],
        valueType: outputKey.includes('file')
          ? 'file'
          : outputKey === 'usage'
            ? 'object'
            : 'string',
        source: 'node',
      }));
    });

  return [...systemVariables, ...nodeVariables];
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

const VariableSelect = ({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: ValueSelector;
  options: VariableOption[];
  onChange: (value: ValueSelector) => void;
  placeholder: string;
}) => {
  const serializedValue = serializeValueSelector(value);

  return (
    <PanelSelect
      className="text-[12px]"
      value={serializedValue}
      onChange={(event) => onChange(parseValueSelector(event.target.value))}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => {
        const serializedOption = serializeValueSelector(option.valueSelector);
        return (
          <option key={serializedOption} value={serializedOption}>
            {option.label}
          </option>
        );
      })}
    </PanelSelect>
  );
};

const InfoTooltip = ({ content }: { content: string }) => {
  return (
    <div className="group relative inline-flex items-center">
      <button
        type="button"
        aria-label={content}
        className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white text-[10px] font-semibold leading-none text-slate-500 transition hover:border-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
      >
        <svg
          viewBox="0 0 1024 1024"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          p-id="5625"
          width="16"
          height="16"
        >
          <path
            d="M512 128c212 0 384 172 384 384s-172 384-384 384-384-172-384-384 172-384 384-384m0-64C264.8 64 64 264.8 64 512s200.8 448 448 448 448-200.8 448-448S759.2 64 512 64z m32 704h-64v-64h64v64z m11.2-203.2l-5.6 4.8c-3.2 2.4-5.6 8-5.6 12.8v58.4h-64v-58.4c0-24.8 11.2-48 29.6-63.2l5.6-4.8c56-44.8 83.2-68 83.2-108C598.4 358.4 560 320 512 320c-49.6 0-86.4 36.8-86.4 86.4h-64C361.6 322.4 428 256 512 256c83.2 0 150.4 67.2 150.4 150.4 0 72.8-49.6 112.8-107.2 158.4z"
            p-id="5626"
            fill="#bfbfbf"
          ></path>
        </svg>
      </button>
      {/* 核心修改：shadow-lg 改为 shadow-md，实现一圈均匀阴影 */}
      <div className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 w-max max-w-[220px] -translate-y-1/2 rounded-lg bg-white px-2 py-1 text-[10px] leading-4 text-slate-900 opacity-0 shadow-md transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        {content}
      </div>
    </div>
  );
};

const LLMPanel = ({ id, data }: NodePanelProps) => {
  const { getNodes, setNodes } = useReactFlow<CanvasNodeData, Edge>();
  const nodeData = data as CanvasNodeData;
  const availableVariables = buildVariableOptions(
    id,
    getNodes().map((node) => ({ id: node.id, data: node.data })),
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
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  inputs: nextValue,
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
    const normalized = JSON.stringify(config);
    if (raw !== normalized) {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                data: {
                  ...node.data,
                  inputs: config,
                },
              }
            : node,
        ),
      );
    }
  }, [config, id, nodeData.inputs, setNodes]);

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

      <PanelSection title="模型">
        <PanelCard className="space-y-2.5 px-4 py-3.5 rounded-xl border border-slate-200/60 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <p className="text-[12px] font-semibold text-slate-700">
                {virtualModel?.label ?? '智灵'}
              </p>
              <InfoTooltip content="虚拟 LLM 统一由后端接入模型决定" />
            </div>
            <button
              type="button"
              onClick={() => setIsModelParamsExpanded((expanded) => !expanded)}
              className="inline-flex items-center justify-center gap-1 rounded-full border border-indigo-200 bg-white px-2.5 pr-1.5 py-1 text-[11px] font-medium text-indigo-600 transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95"
            >
              {isModelParamsExpanded ? '收起参数' : '修改参数'}
              <span
                className={`text-[10px] transition-transform duration-200 flex items-center justify-center ${isModelParamsExpanded ? 'rotate-180' : ''}`}
              >
                <svg
                  viewBox="0 0 1024 1024"
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  p-id="5794"
                  width="16"
                  height="16"
                >
                  <path
                    d="M512 640l-181.034667-180.992 60.373334-60.330667L512 519.338667l120.661333-120.661334 60.373334 60.330667L512 640.042667z"
                    fill="#000000"
                    p-id="5795"
                  ></path>
                </svg>
              </span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
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
          </div>

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
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-4 text-amber-800">
            已启用 Context，但 Prompt 中尚未检测到 context block，可在 Prompt 中插入 {'{{context}}'}{' '}
            或 {'{{#context#}}'}。
          </p>
        ) : null}
      </PanelSection>

      {config.model.name ? (
        <PanelSection title="Prompt">
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
              <button
                type="button"
                onClick={handleAddPromptMessage}
                className="w-full rounded-2xl border border-[#e6ebf2] bg-[#f7f9fc] px-3 py-1.5 text-[12px] font-medium text-slate-700 transition hover:border-[#cfd9ff] hover:text-[#4f6fff]"
              >
                + 添加消息
              </button>
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
            <div className="space-y-1">
              <PanelTextarea
                className="min-h-[136px] font-mono text-[11px] leading-5"
                value={schemaText}
                onChange={(event) => {
                  setSchemaText(event.target.value);
                  setSchemaError(null);
                }}
                onBlur={() => {
                  try {
                    const parsed = JSON.parse(schemaText) as Record<string, unknown> | null;
                    if (!parsed || parsed.type !== 'object') {
                      throw new Error('Schema 根节点必须是 object。');
                    }
                    handleStructuredOutputChange({
                      schema: {
                        type: 'object',
                        properties:
                          typeof parsed.properties === 'object' && parsed.properties
                            ? (parsed.properties as StructuredOutputConfig['schema']['properties'])
                            : {},
                        required: Array.isArray(parsed.required)
                          ? parsed.required.filter(
                              (item): item is string => typeof item === 'string',
                            )
                          : [],
                        additionalProperties: false,
                      },
                    });
                    setSchemaError(null);
                  } catch (error) {
                    setSchemaError(error instanceof Error ? error.message : 'Schema 解析失败');
                  }
                }}
              />
              {schemaError ? (
                <p className="text-[10px] text-rose-600">{schemaError}</p>
              ) : (
                <p className="text-[10px] leading-4 text-slate-500">
                  输入 object root schema，失焦后自动解析并写回节点配置。
                </p>
              )}
            </div>
          </Field>
        ) : null}
      </PanelSection>
    </div>
  );
};

export default React.memo(LLMPanel);
