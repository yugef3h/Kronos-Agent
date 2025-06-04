import React, { useState } from 'react';

/**
 * JSONSchemaInput 结构化 JSON Schema 输入组件
 */
const JSONSchemaInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  onBlur: (parsed: object | null, error: string | null) => void;
  error?: string | null;
}> = ({ value, onChange, onBlur, error }) => {
  const [local, setLocal] = useState(value);
  return (
    <div className="space-y-1">
      <textarea
        className="min-h-[136px] w-full font-mono text-[11px] leading-5 border rounded px-2 py-1"
        value={local}
        onChange={e => {
          setLocal(e.target.value);
          onChange(e.target.value);
        }}
        onBlur={() => {
          try {
            const parsed = JSON.parse(local);
            if (!parsed || parsed.type !== 'object') throw new Error('Schema 根节点必须是 object。');
            onBlur(parsed, null);
          } catch (err) {
            onBlur(null, err instanceof Error ? err.message : 'Schema 解析失败');
          }
        }}
      />
      {error ? (
        <p className="text-[10px] text-rose-600">{error}</p>
      ) : (
        <p className="text-[10px] leading-4 text-slate-500">输入 object root schema，失焦后自动解析并写回节点配置。</p>
      )}
    </div>
  );
};

export default JSONSchemaInput;
