import { IconCondition } from '../assets/condition';
import { IconIteration } from '../assets/iteration';
import { IconLLM } from '../assets/llm';
import { IconKnowledge } from '../assets/knowledge';
import { IconLoop } from '../assets/loop';
import { IconOutput } from '../assets/output';
import {
  CONTAINER_NODE_BOARD_TOP,
  CONTAINER_NODE_HORIZONTAL_PADDING,
} from '../features/container-panel/canvas';
import type { CanvasNodeData } from '../types/canvas';
import WorkflowNodeSummary from './workflow-node-summary';

const IconTrigger = () => {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M5.15625 3.28125C5.15625 2.74724 5.75605 2.4283 6.2015 2.72868L10.6882 5.75455C11.0813 6.01972 11.0813 6.59747 10.6882 6.86264L6.2015 9.88852C5.75605 10.1889 5.15625 9.86995 5.15625 9.33594V3.28125Z"
        fill="currentColor"
      />
      <path
        d="M2.625 2.625C2.625 2.26256 2.91881 1.96875 3.28125 1.96875C3.64369 1.96875 3.9375 2.26256 3.9375 2.625V10.375C3.9375 10.7374 3.64369 11.0312 3.28125 11.0312C2.91881 11.0312 2.625 10.7374 2.625 10.375V2.625Z"
        fill="currentColor"
      />
    </svg>
  );
};

const WorkflowNodeBadgeIcon = ({ kind }: { kind: CanvasNodeData['kind'] }) => {
  if (kind === 'trigger') {
    return <IconTrigger />;
  }

  if (kind === 'llm') {
    return <IconLLM />;
  }

  if (kind === 'knowledge') {
    return <IconKnowledge />;
  }

  if (kind === 'iteration' || kind === 'iteration-start') {
    return <IconIteration />;
  }

  if (kind === 'loop' || kind === 'loop-start') {
    return <IconLoop />;
  }

  if (kind === 'end' || kind === 'iteration-end' || kind === 'loop-end') {
    return <IconOutput />;
  }

  if (kind === 'condition') {
    return <IconCondition />;
  }

  return (
    <span className="text-[10px] font-semibold uppercase text-slate-600">
      {String(kind).slice(0, 2)}
    </span>
  );
};

const getContainerHeaderBadgeClassName = (kind: CanvasNodeData['kind']) => {
  if (kind === 'trigger') {
    return 'bg-emerald-600 text-white shadow-[0_10px_20px_-18px_rgba(5,150,105,0.9)]';
  }

  if (kind === 'iteration') {
    return 'bg-amber-500 text-white shadow-[0_10px_20px_-18px_rgba(217,119,6,0.9)]';
  }

  if (kind === 'loop') {
    return 'bg-blue-600 text-white shadow-[0_10px_20px_-18px_rgba(37,99,235,0.9)]';
  }

  if (kind === 'llm') {
    return 'bg-slate-50 border text-white shadow-[0_10px_20px_-18px_rgba(2,132,199,0.9)]';
  }

  if (kind === 'knowledge') {
    return 'bg-slate-50 border text-white shadow-[0_10px_20px_-18px_rgba(124,58,237,0.9)]';
  }

  if (kind === 'end' || kind === 'iteration-end' || kind === 'loop-end') {
    return 'bg-amber-100 text-white shadow-[0_10px_20px_-18px_rgba(217,119,6,0.9)]';
  }

  if (kind === 'condition') {
    return 'bg-[#16b5d8] text-white shadow-[0_10px_20px_-18px_rgba(8,145,178,0.9)]';
  }

  return 'bg-slate-100 text-slate-700 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.85)]';
};

export const ContainerNodeHeader = ({ kind, title }: Pick<CanvasNodeData, 'kind' | 'title'>) => {
  return (
    <div className="relative z-10 flex items-center gap-3 px-1 pr-8">
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] ${getContainerHeaderBadgeClassName(kind)}`}
      >
        <WorkflowNodeBadgeIcon kind={kind} />
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="text-[16px] font-semibold tracking-[0.01em] text-slate-900">{title}</p>
      </div>
    </div>
  );
};

export const ContainerNodeBoard = () => {
  return (
    <div
      className="pointer-events-none absolute z-[1] overflow-hidden rounded-[16px] border border-[#edf1f7]"
      style={{
        top: CONTAINER_NODE_BOARD_TOP,
        left: CONTAINER_NODE_HORIZONTAL_PADDING,
        right: CONTAINER_NODE_HORIZONTAL_PADDING,
        bottom: CONTAINER_NODE_HORIZONTAL_PADDING,
        backgroundColor: '#f6f8fc',
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(191, 201, 217, 0.72) 1.3px, transparent 0)',
        backgroundSize: '20px 20px',
      }}
    />
  );
};

const NestedNodeBadge = ({ kind }: { kind: CanvasNodeData['kind'] }) => {
  return <WorkflowNodeBadgeIcon kind={kind} />;
};

export const NestedPlainNodeCard = ({
  data,
  isSelected = false,
}: {
  data: CanvasNodeData
  isSelected?: boolean
}) => {
  return (
    <div className={`rounded-[14px] border bg-white px-2.5 py-2 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.28)] ${isSelected ? 'border-components-option-card-option-selected-border' : 'border-slate-200 hover:border-blue-300'}`}>
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-slate-50 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.85)]">
          <NestedNodeBadge kind={data.kind} />
        </div>
        <div className="min-w-0 flex-1">
          {/* <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-500">{data.subtitle}</p> */}
          <p className="mt-0.5 text-[15px] font-semibold leading-[1.15] text-slate-900">{data.title}</p>
        </div>
      </div>

      <WorkflowNodeSummary data={data} compact />
    </div>
  );
};

export const NestedEndNodeCard = ({
  data,
  isSelected = false,
}: {
  data: CanvasNodeData
  isSelected?: boolean
}) => {
  return (
    <div className={`rounded-[14px] border bg-white px-2.5 py-2 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.28)] ${isSelected ? 'border-components-option-card-option-selected-border' : 'border-amber-200/80 hover:border-blue-300'}`}>
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-amber-50 text-amber-600 shadow-[inset_0_0_0_1px_rgba(253,230,138,0.9)]">
          <IconOutput />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-[1.1] text-slate-900">{data.title}</p>
        </div>
      </div>
    </div>
  );
};