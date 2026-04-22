import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorkflowCanvasNodes } from '../context/workflow-canvas-nodes-context';
import type { PanelProps as NodePanelProps } from './custom-node';
import Field from '../base/field';
import PanelAlert from '../base/panel-alert';
import PanelLastRun from '../base/panel-last-run';
import { PanelLastRunStartDetails } from '../base/panel-last-run-start';
import { Dialog, DialogContent, DialogTitle } from '../base/dialog';
import {
  PanelCard,
  PanelInput,
  PanelOutputVarRow,
  PanelSection,
  PanelSelect,
  PanelToggle,
  usePanelTabs,
} from '../base/panel-form';
import type { CanvasNodeData } from '../types/canvas';
import {
  buildStartNodeOutputs,
  buildStartOutputTypes,
  createEmptyStartVariable,
  getStartVariableTypeLabel,
  START_SYSTEM_VARIABLES,
  validateStartNodeConfig,
} from '../panels/start-panel/schema';
import { useStartPanelConfig } from '../panels/start-panel/use-start-panel-config';
import { getStartVariableSummary } from '../panels/start-panel/list-utils';
import type {
  StartNodeConfig,
  StartValidationIssue,
  StartVariable,
  StartVariableType,
} from '../panels/start-panel/types';
import { rewriteNodesVariableReferences } from '../utils/workflow-variable-references';
import { resolveNodeLastRun } from '../utils/resolve-node-last-run';
import type { NodeLastRunSnapshot } from '../types/run';
import { useNodeDebugRun } from '../hooks/use-node-debug-run';
import {
  PANEL_DEBUG_START_VALUES_DEFAULT,
  useNodePanelDebugDraft,
} from '../hooks/use-node-panel-debug-draft';
import { useRegisterPanelNodeDebug } from '../base/panel-node-debug-context';
import { PanelRunDebugButton } from '../base/panel-run-debug-button';
import { useRegisterWorkflowDraftTestRunInputs } from '../context/workflow-draft-test-run-context';
import {
  buildStartPanelDebugInputs,
  getStartPanelDebugConfigIssueMessages,
  mapStartPanelDebugIssuesToFieldErrors,
  mergeStartPanelDebugFormValues,
  validateStartPanelDebugFormValues,
  type StartPanelDebugFormValues,
} from '../panels/start-panel/debug-inputs';

const START_VARIABLE_TYPE_OPTIONS: Array<{ label: string; value: StartVariableType }> = [
  { label: 'Text', value: 'text-input' },
  { label: 'Paragraph', value: 'paragraph' },
  { label: 'Select', value: 'select' },
  { label: 'Number', value: 'number' },
  { label: 'URL', value: 'url' },
  { label: 'JSON', value: 'json' },
  { label: 'Object', value: 'json_object' },
  { label: 'File', value: 'file' },
  { label: 'File List', value: 'file-list' },
  { label: 'Boolean', value: 'checkbox' },
];

const VariableDialog = ({
  open,
  mode,
  draft,
  issues,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  draft: StartVariable | null;
  issues: StartValidationIssue[];
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<StartVariable>) => void;
  onSubmit: () => void;
}) => {
  const getIssueMessage = (field: keyof StartVariable) =>
    issues.find((issue) => issue.path.endsWith(`.${field}`))?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[440px] max-w-[calc(100vw-1rem)] overflow-hidden p-0">
        <div className="flex flex-col overflow-hidden rounded-2xl bg-white">
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
            <DialogTitle>
              <span className="block text-[14px] font-semibold text-slate-900">
                {mode === 'create' ? '新增输入变量' : '编辑输入变量'}
              </span>
            </DialogTitle>
          </div>

          {draft ? (
            <form
              className="space-y-3 px-4 py-3"
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
              }}
            >
              <Field title="变量名" compact required>
                <PanelInput
                  value={draft.variable}
                  placeholder="例如：city"
                  onChange={(event) => onChange({ variable: event.target.value })}
                />
                {getIssueMessage('variable') ? (
                  <p className="mt-1 text-[10px] leading-4 text-rose-600">
                    {getIssueMessage('variable')}
                  </p>
                ) : null}
              </Field>

              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_132px]">
                <Field title="中文释义" compact>
                  <PanelInput
                    value={draft.label}
                    placeholder="例如：城市"
                    onChange={(event) => onChange({ label: event.target.value })}
                  />
                  {getIssueMessage('label') ? (
                    <p className="mt-1 text-[10px] leading-4 text-rose-600">
                      {getIssueMessage('label')}
                    </p>
                  ) : null}
                </Field>
                <Field title="类型" compact>
                  <PanelSelect
                    value={draft.type}
                    onChange={(event) =>
                      onChange({
                        type: event.target.value as StartVariableType,
                        options: event.target.value === 'select' ? draft.options : [],
                      })
                    }
                  >
                    {START_VARIABLE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </PanelSelect>
                </Field>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2">
                <div>
                  <p className="text-[12px] font-semibold text-slate-800">是否必填</p>
                  <p className="text-[10px] text-slate-500">开启后可在执行前做基础校验。</p>
                </div>
                <PanelToggle
                  checked={draft.required}
                  onChange={(checked) => onChange({ required: checked })}
                />
              </div>

              {draft.type === 'select' ? (
                <Field title="选项" compact>
                  <PanelInput
                    value={draft.options.join(', ')}
                    placeholder="用英文逗号分隔，例如：beijing, shanghai"
                    onChange={(event) =>
                      onChange({
                        options: event.target.value
                          .split(',')
                          .map((item) => item.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                  {getIssueMessage('options') ? (
                    <p className="mt-1 text-[10px] leading-4 text-rose-600">
                      {getIssueMessage('options')}
                    </p>
                  ) : null}
                </Field>
              ) : null}

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={issues.length > 0}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  保存
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const StartPanelDebugInputs = ({
  config,
  values,
  isRunning,
  error,
  configIssueMessages,
  fieldErrors,
  onChange,
  onRun,
}: {
  config: StartNodeConfig;
  values: StartPanelDebugFormValues;
  isRunning: boolean;
  error: string | null;
  configIssueMessages: string[];
  fieldErrors: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onRun: () => void;
}) => (
  <PanelSection title="调试输入">
    {configIssueMessages.length > 0 ? (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
        <p className="text-[11px] font-semibold text-rose-800">节点配置有误，请先在「设置」中修复：</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-5 text-rose-700">
          {configIssueMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </div>
    ) : null}
    <Field title="用户问题 (query)" compact required>
      <PanelInput
        value={values.query ?? ''}
        placeholder="例如：帮我总结这份文档"
        aria-invalid={Boolean(fieldErrors.query)}
        className={fieldErrors.query ? 'border-rose-300 focus:border-rose-400' : undefined}
        onChange={(event) => onChange('query', event.target.value)}
      />
      {fieldErrors.query ? (
        <p className="mt-1 text-[10px] leading-4 text-rose-600">{fieldErrors.query}</p>
      ) : null}
    </Field>
    {config.variables.map((variable) => {
      const key = variable.variable.trim();
      if (!key) {
        return null;
      }

      const fieldError = fieldErrors[key];

      return (
        <Field
          key={variable.id}
          title={`${variable.label || key} (${key})`}
          compact
          required={variable.required}
        >
          <PanelInput
            value={values[key] ?? ''}
            placeholder={variable.required ? '必填' : '可选'}
            aria-invalid={Boolean(fieldError)}
            className={fieldError ? 'border-rose-300 focus:border-rose-400' : undefined}
            onChange={(event) => onChange(key, event.target.value)}
          />
          {fieldError ? (
            <p className="mt-1 text-[10px] leading-4 text-rose-600">{fieldError}</p>
          ) : null}
        </Field>
      );
    })}
    {error ? <PanelAlert type="warning">{error}</PanelAlert> : null}
    <PanelRunDebugButton
      isRunning={isRunning}
      onClick={onRun}
      className="w-full rounded-lg bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
    />
  </PanelSection>
);

const StartPanel = ({ id, data }: NodePanelProps) => {
  const { setNodes } = useWorkflowCanvasNodes();
  const [searchParams] = useSearchParams();
  const appId = searchParams.get('appId');
  const nodeData = data as CanvasNodeData;
  const lastRunSectionRef = useRef<HTMLDivElement>(null);
  const [localLastRun, setLocalLastRun] = useState<NodeLastRunSnapshot | null>(null);
  const canvasLastRun = resolveNodeLastRun(id, nodeData);
  const lastRun = canvasLastRun ?? localLastRun;
  const { activeTab, setActiveTab } = usePanelTabs();
  const [isOutputVarsExpanded, setIsOutputVarsExpanded] = useState(false);
  const [debugValues, setDebugValues] = useNodePanelDebugDraft(
    id,
    nodeData._panelDebugDraft,
    PANEL_DEBUG_START_VALUES_DEFAULT,
  );
  const [debugFieldErrors, setDebugFieldErrors] = useState<Record<string, string>>({});
  const [debugConfigIssueMessages, setDebugConfigIssueMessages] = useState<string[]>([]);
  const [draggingVariableId, setDraggingVariableId] = useState<string | null>(null);
  const [dropTargetVariableId, setDropTargetVariableId] = useState<string | null>(null);
  const [editingVariableId, setEditingVariableId] = useState<string | null>(null);
  const [draftVariable, setDraftVariable] = useState<StartVariable | null>(null);

  const {
    config,
    issues,
    handleAddVariable,
    handleUpdateVariable,
    handleRemoveVariable,
    handleReorderVariable,
  } = useStartPanelConfig({
    value: nodeData.inputs,
    onChange: (nextValue, meta) => {
      const nextOutputs = buildStartNodeOutputs(nextValue);
      const nextInputs = {
        ...nextValue,
        _outputTypes: buildStartOutputTypes(nextValue),
      };

      setNodes((nodes) => {
        const nextNodes = nodes.map((node) => {
          if (node.id !== id) return node;

          return {
            ...node,
            data: {
              ...node.data,
              inputs: nextInputs as unknown as Record<string, unknown>,
              outputs: nextOutputs,
            },
          };
        });

        if (meta?.type === 'rename-variable') {
          return rewriteNodesVariableReferences(
            nextNodes,
            [id, meta.previousVariable],
            [id, meta.nextVariable],
            id,
          );
        }

        if (meta?.type === 'remove-variable') {
          return rewriteNodesVariableReferences(nextNodes, [id, meta.variable], null, id);
        }

        return nextNodes;
      });
    },
  });

  useEffect(() => {
    const rawInputs = JSON.stringify(nodeData.inputs ?? null);
    const normalizedInputs = JSON.stringify({
      ...config,
      _outputTypes: buildStartOutputTypes(config),
    });
    const rawOutputs = JSON.stringify(nodeData.outputs ?? null);
    const normalizedOutputs = JSON.stringify(buildStartNodeOutputs(config));

    if (rawInputs !== normalizedInputs || rawOutputs !== normalizedOutputs) {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== id) return node;

          return {
            ...node,
            data: {
              ...node.data,
              inputs: {
                ...config,
                _outputTypes: buildStartOutputTypes(config),
              } as unknown as Record<string, unknown>,
              outputs: buildStartNodeOutputs(config),
            },
          };
        }),
      );
    }
  }, [config, id, nodeData.inputs, nodeData.outputs, setNodes]);

  useEffect(() => {
    setDebugValues((previous) => mergeStartPanelDebugFormValues(config, previous));
  }, [config, setDebugValues]);

  useEffect(() => {
    if (nodeData._lastRun) {
      setLocalLastRun(null);
    }
  }, [nodeData._lastRun]);

  const debugInputs = useMemo(
    () => buildStartPanelDebugInputs(config, debugValues),
    [config, debugValues],
  );

  const getDraftRunInputs = useCallback(
    () => buildStartPanelDebugInputs(config, debugValues),
    [config, debugValues],
  );
  useRegisterWorkflowDraftTestRunInputs(getDraftRunInputs);

  const startNodeInputs = useMemo(
    () => ({
      variables: config.variables,
    }),
    [config.variables],
  );

  const { runDebug, isRunning, error, clearError } = useNodeDebugRun({
    appId,
    nodeId: id,
    nodeKind: 'trigger',
    nodeInputs: startNodeInputs,
    debugInputs,
  });

  const handleDebugValueChange = useCallback((key: string, value: string) => {
    clearError();
    setDebugFieldErrors((previous) => {
      if (!previous[key]) {
        return previous;
      }

      const next = { ...previous };
      delete next[key];
      return next;
    });
    setDebugValues((previous) => ({
      ...previous,
      [key]: value,
    }));
  }, [clearError, setDebugValues]);

  const handleRunDebug = useCallback(async () => {
    const validationIssues = validateStartPanelDebugFormValues(config, debugValues);
    if (validationIssues.length > 0) {
      setDebugConfigIssueMessages(getStartPanelDebugConfigIssueMessages(validationIssues));
      setDebugFieldErrors(mapStartPanelDebugIssuesToFieldErrors(validationIssues));
      setActiveTab('last-run');
      return;
    }

    setDebugConfigIssueMessages([]);
    setDebugFieldErrors({});
    setActiveTab('last-run');

    const snapshot = await runDebug();
    if (!snapshot) {
      return;
    }

    setLocalLastRun(snapshot);
    requestAnimationFrame(() => {
      lastRunSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [config, debugValues, runDebug, setActiveTab]);

  useRegisterPanelNodeDebug(id, {
    runDebug: handleRunDebug,
    isRunning,
    disabled: !appId?.trim(),
  });

  const draftVariableIssues = useMemo(() => {
    if (!draftVariable) return [];

    const nextVariables = editingVariableId
      ? config.variables.map((variable) =>
          variable.id === editingVariableId ? draftVariable : variable,
        )
      : [...config.variables, draftVariable];
    const draftIndex = editingVariableId
      ? nextVariables.findIndex((variable) => variable.id === editingVariableId)
      : nextVariables.length - 1;

    return validateStartNodeConfig({ variables: nextVariables }).filter((issue) =>
      issue.path.startsWith(`variables.${draftIndex}.`),
    );
  }, [config.variables, draftVariable, editingVariableId]);

  const handleOpenCreateDialog = () => {
    setEditingVariableId(null);
    setDraftVariable(createEmptyStartVariable());
  };

  const handleOpenEditDialog = (variable: StartVariable) => {
    setEditingVariableId(variable.id);
    setDraftVariable({ ...variable, options: [...variable.options] });
  };

  const handleCloseDialog = (open: boolean) => {
    if (open) return;

    setEditingVariableId(null);
    setDraftVariable(null);
  };

  const handleDraftVariableChange = (patch: Partial<StartVariable>) => {
    setDraftVariable((current) => (current ? { ...current, ...patch } : current));
  };

  const handleSubmitVariableDialog = () => {
    if (!draftVariable || draftVariableIssues.length > 0) return;

    const trimmedVariable = draftVariable.variable.trim();
    const nextVariable = {
      ...draftVariable,
      variable: trimmedVariable,
      label: draftVariable.label.trim() || trimmedVariable,
    };

    if (editingVariableId) {
      handleUpdateVariable(editingVariableId, nextVariable);
    } else {
      handleAddVariable(nextVariable);
    }

    setEditingVariableId(null);
    setDraftVariable(null);
  };

  const handleVariableDragStart = (variableId: string) => {
    setDraggingVariableId(variableId);
    setDropTargetVariableId(variableId);
  };

  const handleVariableDragEnd = () => {
    setDraggingVariableId(null);
    setDropTargetVariableId(null);
  };

  return (
    <div className="space-y-3">
      {activeTab === 'last-run' ? (
        <div className="space-y-3">
          <div ref={lastRunSectionRef} className="space-y-3">
            <PanelSection title="运行结果">
              {lastRun ? <PanelLastRunStartDetails lastRun={lastRun} /> : null}
              <PanelLastRun
                lastRun={lastRun}
                emptyDescription="在下方填写调试输入并点击「运行调试」后，这里会展示输入、输出与耗时。"
              />
            </PanelSection>
          </div>
          <StartPanelDebugInputs
            config={config}
            values={debugValues}
            isRunning={isRunning}
            error={error}
            configIssueMessages={debugConfigIssueMessages}
            fieldErrors={debugFieldErrors}
            onChange={handleDebugValueChange}
            onRun={() => {
              void handleRunDebug();
            }}
          />
        </div>
      ) : null}

      {activeTab === 'settings' ? (
        <>
          <PanelSection
            title="单节点调试"
            aside={
              <PanelRunDebugButton
                isRunning={isRunning}
                onClick={handleRunDebug}
                runningLabel="调试中…"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                调试此节点
              </PanelRunDebugButton>
            }
          >
            <p className="text-[11px] leading-5 text-slate-500">
              在「上次运行」页填写 query 与变量取值后运行；也可直接点此按钮使用当前调试参数。
            </p>
            {error ? <PanelAlert type="warning">{error}</PanelAlert> : null}
          </PanelSection>

          <PanelSection
            title="系统变量"
            aside={
              <button
                type="button"
                onClick={() => setIsOutputVarsExpanded((expanded) => !expanded)}
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
                  <path
                    d="M512 640l-181.034667-180.992 60.373334-60.330667L512 519.338667l120.661333-120.661334 60.373334 60.330667L512 640.042667z"
                    fill="currentColor"
                  ></path>
                </svg>
              </button>
            }
          >
            {isOutputVarsExpanded ? (
              <PanelCard className="space-y-2 bg-white p-2.5 shadow-none">
                {START_SYSTEM_VARIABLES.map((item) => (
                  <PanelOutputVarRow
                    key={item.variable}
                    name={item.variable}
                    type={item.type}
                    description={item.description}
                  />
                ))}
              </PanelCard>
            ) : null}
          </PanelSection>

          <PanelSection
            title="输入变量"
            aside={
              <button
                type="button"
                onClick={handleOpenCreateDialog}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white text-[15px] text-slate-600 transition hover:bg-[#c8ceda33]"
                aria-label="新增输入变量"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </button>
            }
          >
            {issues.length ? <PanelAlert type="warning">{issues[0].message}</PanelAlert> : null}
            {config.variables.length ? (
              <div className="space-y-1.5">
                {config.variables.map((variable) => (
                  <div
                    key={variable.id}
                    draggable
                    onDragStart={(event: React.DragEvent<HTMLDivElement>) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', variable.id);
                      handleVariableDragStart(variable.id);
                    }}
                    onDragOver={(event: React.DragEvent<HTMLDivElement>) => {
                      event.preventDefault();
                      if (draggingVariableId && draggingVariableId !== variable.id) {
                        setDropTargetVariableId(variable.id);
                      }
                    }}
                    onDrop={(event: React.DragEvent<HTMLDivElement>) => {
                      event.preventDefault();
                      if (draggingVariableId && draggingVariableId !== variable.id) {
                        handleReorderVariable(draggingVariableId, variable.id);
                      }
                      handleVariableDragEnd();
                    }}
                    onDragEnd={handleVariableDragEnd}
                  >
                    <PanelCard
                      className={`group border-[#e8edf5] bg-white px-2.5 py-2 shadow-none transition ${
                        draggingVariableId === variable.id ? 'opacity-70' : ''
                      } ${dropTargetVariableId === variable.id && draggingVariableId !== variable.id ? 'border-[#cfd9ff] bg-[#f8fbff]' : ''}`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap text-[12px] text-slate-700">
                        <span className="flex h-5 w-5 shrink-0 cursor-grab items-center justify-center rounded-md text-slate-300 transition group-hover:text-slate-500 active:cursor-grabbing">
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <circle cx="8" cy="6" r="1.5" />
                            <circle cx="16" cy="6" r="1.5" />
                            <circle cx="8" cy="12" r="1.5" />
                            <circle cx="16" cy="12" r="1.5" />
                            <circle cx="8" cy="18" r="1.5" />
                            <circle cx="16" cy="18" r="1.5" />
                          </svg>
                        </span>

                        <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          {getStartVariableTypeLabel(variable.type)}
                        </span>

                        {variable.required ? (
                          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            必填
                          </span>
                        ) : null}

                        <span className="truncate font-medium text-slate-800">
                          {variable.label || variable.variable}
                        </span>
                        <span className="shrink-0 text-slate-300">/</span>
                        <span className="truncate text-[11px] text-slate-500">
                          {variable.variable || '未设置变量名'}
                        </span>

                        {getStartVariableSummary(variable) ? (
                          <span className="truncate text-[11px] text-slate-400">
                            {getStartVariableSummary(variable)}
                          </span>
                        ) : null}

                        <div className="ml-auto flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                          <button
                            type="button"
                            aria-label="编辑输入变量"
                            onClick={() => handleOpenEditDialog(variable)}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              width="14"
                              height="14"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              aria-hidden="true"
                            >
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            aria-label="删除输入变量"
                            onClick={() => handleRemoveVariable(variable.id)}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              width="14"
                              height="14"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              aria-hidden="true"
                            >
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </PanelCard>
                  </div>
                ))}
              </div>
            ) : (
              <PanelCard className="bg-white px-3 py-2.5 shadow-none">
                <p className="text-[12px] font-semibold text-slate-800">还没有自定义输入变量</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  右上角点 + 新增，保存后会以紧凑单行列表展示，并支持拖拽排序。
                </p>
              </PanelCard>
            )}
          </PanelSection>

          <VariableDialog
            open={draftVariable !== null}
            mode={editingVariableId ? 'edit' : 'create'}
            draft={draftVariable}
            issues={draftVariableIssues}
            onOpenChange={handleCloseDialog}
            onChange={handleDraftVariableChange}
            onSubmit={handleSubmitVariableDialog}
          />
        </>
      ) : null}
    </div>
  );
};

export default React.memo(StartPanel);
