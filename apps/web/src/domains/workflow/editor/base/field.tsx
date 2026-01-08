'use client'
import type { FC, ReactNode } from 'react'
import { useBoolean } from 'ahooks'
import * as React from 'react'
import { cn } from '../utils/classnames'

type Props = {
  className?: string
  title: ReactNode
  tooltip?: ReactNode
  isSubTitle?: boolean
  supportFold?: boolean
  children?: ReactNode
  operations?: ReactNode
  inline?: boolean
  required?: boolean
  compact?: boolean
  titleClassName?: string
  contentClassName?: string
}

const Field: FC<Props> = ({
  className,
  title,
  isSubTitle,
  children,
  operations,
  inline,
  supportFold,
  required,
  compact,
  titleClassName,
  contentClassName,
}) => {
  const [fold, {
    toggle: toggleFold,
  }] = useBoolean(true)
  return (
    <div className={cn(className, inline && 'flex w-full items-start justify-between gap-3')}>
      <div
        onClick={() => supportFold && toggleFold()}
        className={cn('flex items-center justify-between gap-2', supportFold && 'cursor-pointer')}
      >
        <div className={cn('flex items-center', compact ? 'h-4.5' : 'h-6')}>
          <div className={cn(
            isSubTitle
              ? 'text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400'
              : compact
                ? 'text-[11px] font-medium leading-4 text-slate-500'
                : 'text-[12px] font-medium leading-5 text-slate-500',
            titleClassName,
          )}>
            {title}
            {' '}
            {required && <span className="ml-0.5 align-middle text-[12px] font-semibold text-[#ff4d4f]">*</span>}
          </div>
        </div>
        <div className="flex">
          {!!operations && <div>{operations}</div>}
        </div>
      </div>
      {!!(children && (!supportFold || (supportFold && !fold))) && <div className={cn(!inline && (compact ? 'mt-0.5' : 'mt-1.5'), contentClassName)}>{children}</div>}
    </div>
  )
}
export default React.memo(Field)
