import { useMemo, useRef } from 'react'
import Field from './field'
import PanelAlert from './panel-alert'
import { PanelTextarea } from './panel-form'
import {
  WorkflowPromptEditor,
  type WorkflowPromptEditorHandle,
} from './workflow-prompt-editor'
import { WorkflowVariableInsertTrigger } from './workflow-variable-insert-trigger'
import type { VariableOption } from '../panels/llm-panel/types'
import { LLM_DEBUG_HIDDEN_PATHS, type LlmDebugVariableField } from '../utils/llm-debug-context'
import { serializeValueSelector } from '../utils/variable-options'

export type { LlmDebugVariableField } from '../utils/llm-debug-context'

const resolveFieldMeta = (
  path: string,
  variableOptions: VariableOption[],
): Pick<LlmDebugVariableField, 'label' | 'kind'> => {
  const matched = variableOptions.find(
    (option) => serializeValueSelector(option.valueSelector) === path,
  )

  if (path === 'sys.query') {
    return {
      label: '用户问题',
      kind: 'query',
    }
  }

  if (matched) {
    return {
      label: matched.label,
      kind: matched.valueType === 'object' || matched.valueType === 'array' ? 'json' : 'text',
    }
  }

  return {
    label: path,
    kind: 'text',
  }
}

export const buildLlmDebugVariableFields = (
  paths: string[],
  variableOptions: VariableOption[],
): LlmDebugVariableField[] =>
  paths.filter((path) => !LLM_DEBUG_HIDDEN_PATHS.has(path)).map((path) => {
    const meta = resolveFieldMeta(path, variableOptions)
    return {
      path,
      label: meta.label,
      kind: meta.kind,
      required: path === 'sys.query',
    }
  })

type LlmDebugFieldEditorProps = {
  field: LlmDebugVariableField
  value: string
  variableOptions: VariableOption[]
  onChange: (path: string, value: string) => void
}

const LlmDebugFieldEditor = ({
  field,
  value,
  variableOptions,
  onChange,
}: LlmDebugFieldEditorProps) => {
  const editorRef = useRef<WorkflowPromptEditorHandle>(null)

  if (field.kind === 'json') {
    return (
      <PanelTextarea
        rows={2}
        value={value}
        placeholder='[] 或 {"key": "value"}'
        onChange={(event) => onChange(field.path, event.target.value)}
        className="font-mono text-[11px]"
      />
    )
  }

  const placeholder = field.kind === 'query'
    ? '例如：帮我总结这份文档；输入 { 或 / 可插入上游变量引用'
    : '填写模拟值；输入 { 或 / 可插入上游变量引用'

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex justify-end">
        <WorkflowVariableInsertTrigger
          options={variableOptions}
          onInsert={(selector) => editorRef.current?.insertVariable(selector)}
        />
      </div>
      <WorkflowPromptEditor
        ref={editorRef}
        value={value}
        variableOptions={variableOptions}
        onChange={(next) => onChange(field.path, next)}
        rows={field.kind === 'query' ? 3 : 2}
        placeholder={placeholder}
      />
    </div>
  )
}

type PanelLlmDebugInputsProps = {
  fields: LlmDebugVariableField[]
  values: Record<string, string>
  variableOptions: VariableOption[]
  onChange: (path: string, value: string) => void
  emptyHint?: string
}

export const PanelLlmDebugInputs = ({
  fields,
  values,
  variableOptions,
  onChange,
  emptyHint = '当前 Prompt 未使用 {{#变量#}} 占位符，可直接运行调试。',
}: PanelLlmDebugInputsProps) => {
  const orderedFields = useMemo(() => {
    const queryFields = fields.filter((field) => field.kind === 'query')
    const otherFields = fields.filter((field) => field.kind !== 'query')
    return [...queryFields, ...otherFields]
  }, [fields])

  if (!orderedFields.length) {
    return (
      <PanelAlert type="info">{emptyHint}</PanelAlert>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-5 text-slate-500">
        按 Prompt 中的变量填写模拟值；输入 {'{'} 或 / 可从上游链路选择变量（与编排页、设置 Prompt 相同交互）。复杂结构字段仍用 JSON 文本。
      </p>
      {orderedFields.map((field) => (
        <Field
          key={field.path}
          title={field.label}
          compact
          required={field.required}
        >
          <LlmDebugFieldEditor
            field={field}
            value={values[field.path] ?? ''}
            variableOptions={variableOptions}
            onChange={onChange}
          />
        </Field>
      ))}
    </div>
  )
}
