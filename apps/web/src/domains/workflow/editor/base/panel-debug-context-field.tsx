import Field from './field'
import PanelAlert from './panel-alert'
import { PanelTextarea } from './panel-form'

export const PanelDebugContextField = ({
  value,
  onChange,
  parseError,
  hint = '可选。用于 End / If-Else 等节点在上游未执行时模拟变量池，格式为 JSON 对象。',
}: {
  value: string
  onChange: (value: string) => void
  parseError?: string | null
  hint?: string
}) => (
  <Field title="Mock 上下文 (JSON)" compact>
    <PanelTextarea
      value={value}
      rows={4}
      placeholder='{"node-id.query": "hello"}'
      onChange={(event) => onChange(event.target.value)}
    />
    <p className="mt-1 text-[11px] leading-5 text-slate-500">{hint}</p>
    {parseError ? <PanelAlert type="warning">{parseError}</PanelAlert> : null}
  </Field>
)
