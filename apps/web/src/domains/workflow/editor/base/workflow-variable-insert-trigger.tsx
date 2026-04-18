import { useState } from 'react'
import VariableSelect from '../../../../components/form/variable-select'
import { PANEL_Z_INDEX } from '../layout-constants'
import type { ValueSelector, VariableOption } from '../panels/llm-panel/types'

const PANEL_MENU_Z_INDEX = PANEL_Z_INDEX + 40

type WorkflowVariableInsertTriggerProps = {
  options: VariableOption[]
  onInsert: (selector: ValueSelector) => void
  disabled?: boolean
}

/** 上游变量下拉（与「上下文」区 VariableSelect 同款） */
export const WorkflowVariableInsertTrigger = ({
  options,
  onInsert,
  disabled = false,
}: WorkflowVariableInsertTriggerProps) => {
  const [pickerValue, setPickerValue] = useState<ValueSelector>(
    () => options[0]?.valueSelector ?? ['sys', 'query'],
  )

  if (!options.length) {
    return null
  }

  return (
    <VariableSelect
      pillTrigger
      value={pickerValue}
      options={options}
      disabled={disabled}
      onChange={(selector) => {
        onInsert(selector)
        setPickerValue(selector)
      }}
      placeholder="插入变量"
      className="w-[128px] shrink-0"
      menuZIndex={PANEL_MENU_Z_INDEX}
    />
  )
}
