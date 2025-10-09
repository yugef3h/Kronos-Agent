import type { MouseEvent, ReactNode } from 'react';
import { X_OFFSET } from '../layout-constants';
import { CONTAINER_START_ICON_OFFSET } from '../features/container-panel/canvas';
import type { CanvasNodeData } from '../types/canvas';
import { IconStart } from '../assets/start';

type ContainerStartNodeProps = {
  kind: Extract<CanvasNodeData['kind'], 'iteration-start' | 'loop-start'>
  showAddBlock: boolean
  onToggleMenu: (event: MouseEvent<HTMLButtonElement>) => void
  searchBox?: ReactNode
}

export const ContainerStartNode = ({
  showAddBlock,
  onToggleMenu,
  searchBox,
}: ContainerStartNodeProps) => {
  return (
    <div className="flex h-full items-center">
      <div className="flex items-center">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2f6feb] text-white shadow-[0_14px_28px_-20px_rgba(47,111,235,0.9)]"
          style={{ marginLeft: CONTAINER_START_ICON_OFFSET }}
        >
          <IconStart />
        </div>
        {showAddBlock ? (
          <>
            <div
              className="h-px bg-slate-300"
              style={{ width: X_OFFSET }}
            />
            <div className="relative">
              <button
                type="button"
                className="flex h-8 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-[12px] font-semibold text-slate-700 shadow-[0_8px_18px_-20px_rgba(15,23,42,0.3)] transition hover:border-blue-200 hover:text-blue-600"
                onClick={onToggleMenu}
              >
                <span className="text-[12px] leading-none text-slate-400">+</span>
                <span>添加节点</span>
              </button>
              {searchBox}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
