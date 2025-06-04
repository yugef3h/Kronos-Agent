import React from 'react';

/**
 * AddItemButton 添加按钮
 */
const AddItemButton: React.FC<{
  onClick: () => void;
  children?: React.ReactNode;
}> = ({ onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full rounded-2xl border border-[#e6ebf2] bg-[#f7f9fc] px-3 py-1.5 text-[12px] font-medium text-slate-700 transition hover:border-[#cfd9ff] hover:text-[#4f6fff]"
  >
    {children || '+ 添加'}
  </button>
);

export default AddItemButton;
