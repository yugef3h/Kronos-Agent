import React from 'react';
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
    <select
      className="text-[12px] border rounded px-2 py-1"
      value={serializedValue}
      onChange={e => onChange(parseValueSelector(e.target.value))}
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
    </select>
  );
};

export default VariableSelect;
