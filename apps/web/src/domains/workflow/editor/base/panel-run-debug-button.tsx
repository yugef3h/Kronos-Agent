import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/classnames'

export const PanelButtonSpinner = ({ className = '' }: { className?: string }) => (
  <span
    className={cn(
      'inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current/25 border-t-current',
      className,
    )}
    aria-hidden
  />
)

type PanelRunDebugButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  isRunning: boolean
  children?: ReactNode
  runningLabel?: string
}

export const PanelRunDebugButton = ({
  isRunning,
  disabled,
  children = '运行调试',
  runningLabel = '调试中…',
  className,
  type = 'button',
  ...rest
}: PanelRunDebugButtonProps) => (
  <button
    type={type}
    disabled={disabled || isRunning}
    aria-busy={isRunning}
    className={cn('inline-flex items-center justify-center gap-2', className)}
    {...rest}
  >
    {isRunning ? <PanelButtonSpinner /> : null}
    <span>{isRunning ? runningLabel : children}</span>
  </button>
)
