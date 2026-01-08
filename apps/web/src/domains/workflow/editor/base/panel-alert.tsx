import React from 'react';

/**
 * PanelAlert 警告/提示信息
 */
const PanelAlert: React.FC<{
  type?: 'warning' | 'info' | 'error';
  children: React.ReactNode;
}> = ({ type = 'info', children }) => {
  const styleMap = {
    info: 'border-blue-200 bg-blue-50 text-blue-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    error: 'border-rose-200 bg-rose-50 text-rose-700',
  };
  return (
    <section className={`rounded-2xl border p-2.5 text-[11px] leading-4 ${styleMap[type]}`}>
      {children}
    </section>
  );
};

export default PanelAlert;
