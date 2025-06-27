import { IconCondition } from '../assets/condition';
import { IconLLM } from '../assets/llm';
import { IconKnowledge } from '../assets/knowledge';
import { IconOutput } from '../assets/output';
import {
  CONTAINER_NODE_BOARD_TOP,
  CONTAINER_NODE_HORIZONTAL_PADDING,
} from '../features/container-panel/canvas';
import type { CanvasNodeData } from '../types/canvas';

export const ContainerNodeHeader = ({ subtitle, title }: Pick<CanvasNodeData, 'subtitle' | 'title'>) => {
  return (
    <div className="relative z-10 px-1">
      <p className="text-xs font-semibold text-slate-500">{subtitle}</p>
      <p className="mt-1 text-lg font-semibold leading-none tracking-[-0.02em] text-slate-950">{title}</p>
    </div>
  );
};

export const ContainerNodeBoard = () => {
  return (
    <div
      className="pointer-events-none absolute z-[1] overflow-hidden rounded-[24px] border border-[#edf1f7]"
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
  if (kind === 'llm') {
    return <IconLLM />;
  }

  if (kind === 'knowledge') {
    return <IconKnowledge />;
  }

  if (kind === 'end' || kind === 'iteration-end' || kind === 'loop-end') {
    return <IconOutput />;
  }

  if (kind === 'condition') {
    return <IconCondition />;
  }

  return (
    <span className="text-[10px] font-semibold uppercase text-slate-600">
      {kind.slice(0, 2)}
    </span>
  );
};

export const NestedPlainNodeCard = ({ data }: { data: CanvasNodeData }) => {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-white px-2.5 py-2 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.28)]">
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-slate-50 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.85)]">
          <NestedNodeBadge kind={data.kind} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-500">{data.subtitle}</p>
          <p className="mt-0.5 text-[15px] font-semibold leading-[1.15] text-slate-900">{data.title}</p>
        </div>
      </div>

      {data.kind === 'knowledge' && data._datasets?.length ? (
        <div className="mt-1.5 space-y-1">
          {data._datasets.slice(0, 2).map(dataset => (
            <div
              key={dataset.id}
              className="rounded-md bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.72)]"
            >
              <span className="line-clamp-1">{dataset.name}</span>
            </div>
          ))}
          {data._datasets.length > 2 ? (
            <p className="text-[10px] text-slate-400">+{data._datasets.length - 2} 个知识库</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export const NestedEndNodeCard = ({ data }: { data: CanvasNodeData }) => {
  return (
    <div className="rounded-[14px] border border-amber-200/80 bg-white px-2.5 py-2 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.28)]">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-amber-50 text-amber-600 shadow-[inset_0_0_0_1px_rgba(253,230,138,0.9)]">
          <IconOutput />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-amber-700">{data.subtitle}</p>
          <p className="mt-0.5 text-[14px] font-semibold leading-[1.1] text-slate-900">{data.title}</p>
        </div>
      </div>
    </div>
  );
};