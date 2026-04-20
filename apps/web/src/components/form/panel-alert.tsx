import { cn } from '../../domains/workflow/editor/utils/classnames';
import type { ReactNode } from 'react';

export type PanelAlertType = 'success' | 'info' | 'warning' | 'error';

export type PanelAlertProps = {
  type?: PanelAlertType;
  /** 标题，类似 Ant Design Alert `message` */
  title?: ReactNode;
  /** 多条说明时渲染为列表 */
  messages?: string[];
  children?: ReactNode;
  showIcon?: boolean;
  className?: string;
};

const STYLE_MAP: Record<
  PanelAlertType,
  { root: string; icon: string; title: string; body: string }
> = {
  success: {
    root: 'border-emerald-200/90 bg-emerald-50',
    icon: 'text-emerald-600',
    title: 'text-emerald-900',
    body: 'text-emerald-800',
  },
  info: {
    root: 'border-blue-200/90 bg-blue-50',
    icon: 'text-blue-600',
    title: 'text-blue-900',
    body: 'text-blue-800',
  },
  warning: {
    root: 'border-amber-200/90 bg-[#fffbe6]',
    icon: 'text-amber-600',
    title: 'text-amber-950',
    body: 'text-amber-900',
  },
  error: {
    root: 'border-rose-200/90 bg-[#fff2f0]',
    icon: 'text-rose-600',
    title: 'text-rose-950',
    body: 'text-rose-800',
  },
};

const AlertIcon = ({ type }: { type: PanelAlertType }) => {
  const className = cn('size-4 shrink-0', STYLE_MAP[type].icon);

  if (type === 'success') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5-3.5-3.5 1.41-1.41L11 13.67l5.59-5.59 1.41 1.41L11 16.5z"
        />
      </svg>
    );
  }

  if (type === 'info') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
      />
    </svg>
  );
};

/**
 * Ant Design Alert 风格的 Panel 提示条（图标 + 标题 + 正文/列表）。
 */
export const PanelAlert = ({
  type = 'info',
  title,
  messages,
  children,
  showIcon = true,
  className,
}: PanelAlertProps) => {
  const styles = STYLE_MAP[type];
  const body = children ?? (
    messages && messages.length > 0 ? (
      <ul className={cn('mt-1 list-disc space-y-1 pl-4 text-[11px] leading-5', styles.body)}>
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    ) : null
  );

  return (
    <div
      role="alert"
      className={cn(
        'flex gap-2.5 rounded-lg border px-3 py-2.5',
        styles.root,
        className,
      )}
    >
      {showIcon ? (
        <span className="mt-0.5">
          <AlertIcon type={type} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        {title ? (
          <p className={cn('text-[11px] font-semibold leading-5', styles.title)}>{title}</p>
        ) : null}
        {body ? (
          <div className={cn(!title ? '' : 'mt-0.5', 'text-[11px] leading-5', styles.body)}>
            {body}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PanelAlert;
