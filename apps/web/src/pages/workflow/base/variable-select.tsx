import React from 'react';
import { PanelSelect } from './panel-form';
import type { ValueSelector, VariableOption } from '../features/llm-panel/types';

const serializeValueSelector = (valueSelector: ValueSelector): string => valueSelector.join('.');
const parseValueSelector = (value: string): ValueSelector => value.split('.').filter(Boolean);

/**
 * VariableSelect 变量选择器
 */
const VariableSelect: React.FC<{
  value: ValueSelector;
  options: VariableOption[];
  onChange: (value: ValueSelector) => void;
  placeholder: string;
}> = ({ value, options, onChange, placeholder }) => {
  const serializedValue = serializeValueSelector(value);
  return (
    <PanelSelect
      className="w-full text-[12px]"
      value={serializedValue}
      onChange={(event) => onChange(parseValueSelector(event.target.value))}
    >
      <option value="">{placeholder}</option>
      {options.map(option => {
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

export default VariableSelect;
