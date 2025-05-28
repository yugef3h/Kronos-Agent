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
  children?: React.JSX.Element | string | null
  operations?: React.JSX.Element
  inline?: boolean
  required?: boolean
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
}) => {
  const [fold, {
    toggle: toggleFold,
  }] = useBoolean(true)
  return (
    <div className={cn(className, inline && 'flex w-full items-center justify-between')}>
      <div
        onClick={() => supportFold && toggleFold()}
        className={cn('flex items-center justify-between', supportFold && 'cursor-pointer')}
      >
        <div className="flex h-6 items-center">
          <div className={cn(isSubTitle ? 'system-xs-medium-uppercase text-text-tertiary' : 'system-sm-semibold-uppercase text-text-secondary')}>
            {title}
            {' '}
            {required && <span className="text-text-destructive">*</span>}
          </div>
        </div>
        <div className="flex">
          {!!operations && <div>{operations}</div>}
        </div>
      </div>
      {!!(children && (!supportFold || (supportFold && !fold))) && <div className={cn(!inline && 'mt-1')}>{children}</div>}
    </div>
  )
}
export default React.memo(Field)
