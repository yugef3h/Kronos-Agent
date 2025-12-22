import taobaoIcon from '../../../assets/taobao.png';
import {
  MODALITY_INVOCATION_LABELS,
  TOOL_INVOCATION_LABELS,
} from '../assistantInvocation';
import type { AssistantInvocationSummary, PlaygroundModality } from '../types';

type AssistantInvocationBarProps = {
  invocation: AssistantInvocationSummary;
  className?: string;
};

const ModalityIcon = ({ kind }: { kind: PlaygroundModality }) => {
  if (kind === 'takeout') {
    return (
      <span className="inline-flex h-6 w-6 overflow-hidden rounded-full ring-1 ring-slate-200/90">
        <img src={taobaoIcon} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }

  if (kind === 'image') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="10" r="1.4" />
        <path d="m21 16-5.5-5.5L8 18" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
};

const ToolIcon = ({ name }: { name: string }) => {
  if (name === 'web_search') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
};

export const AssistantInvocationBar = ({ invocation, className }: AssistantInvocationBarProps) => {
  const modalityItems = invocation.modalities.map((kind) => ({
    key: `modality-${kind}`,
    label: MODALITY_INVOCATION_LABELS[kind],
    icon: <ModalityIcon kind={kind} />,
  }));

  const toolItems = invocation.tools.map((name) => ({
    key: `tool-${name}`,
    label: TOOL_INVOCATION_LABELS[name] ?? name,
    icon: <ToolIcon name={name} />,
  }));

  const items = [...modalityItems, ...toolItems];

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={`mb-2 flex flex-wrap items-center gap-1 border-b border-slate-100 pb-2 ${className ?? ''}`}
      role="group"
      aria-label="本次回答调用的能力与工具"
    >
      {items.map((item) => (
        <span
          key={item.key}
          title={item.label}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
        >
          <span className="sr-only">{item.label}</span>
          {item.icon}
        </span>
      ))}
    </div>
  );
};
