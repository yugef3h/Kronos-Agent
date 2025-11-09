import { Tooltip } from '@base-ui/react/tooltip';
import type { ReactNode } from 'react';

import { cn } from '../../pages/workflow/utils/classnames';

export type PanelInfoHintProps = {
  /** 提示正文（白底浮层内） */
  content: ReactNode;
  /** 相对触发器：默认在上方，与常见「问号说明」一致 */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** 触发器外层 */
  className?: string;
  /** 问号按钮样式 */
  triggerClassName?: string;
  /** 浮层额外样式 */
  popupClassName?: string;
  /** 悬停多久出现（ms） */
  delay?: number;
};

/**
 * 统一「问号」说明：白底圆角浮层 + 轻阴影，可复用于编排 / 表单等。
 */
export const PanelInfoHint = ({
  content,
  side = 'top',
  className,
  triggerClassName,
  popupClassName,
  delay = 200,
}: PanelInfoHintProps) => {
  return (
    <Tooltip.Provider delay={delay} closeDelay={80}>
      <Tooltip.Root>
        <span className={cn('inline-flex align-middle', className)}>
          <Tooltip.Trigger
            type="button"
            aria-label="查看说明"
            className={cn(
              'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#c9d4e8] bg-white text-[11px] font-semibold leading-none text-slate-500 transition hover:border-[#9fb0cc] hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b7cff]/35',
              triggerClassName,
            )}
          >
            ?
          </Tooltip.Trigger>
        </span>
        <Tooltip.Portal>
          <Tooltip.Positioner side={side} sideOffset={8} align="center" className="z-[200] outline-none">
            <Tooltip.Popup
              className={cn(
                'max-w-[min(22rem,calc(100vw-1.5rem))] rounded-[10px] border border-slate-200/95 bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-700 shadow-[0_10px_32px_rgba(15,23,42,0.14)]',
                popupClassName,
              )}
            >
              {content}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
