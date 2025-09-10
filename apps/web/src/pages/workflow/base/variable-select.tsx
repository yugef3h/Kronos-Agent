import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { panelControlClassName } from './panel-form'
import { cn } from '../utils/classnames'
import type { ValueSelector, VariableOption } from '../features/llm-panel/types'

const serializeValueSelector = (valueSelector: ValueSelector): string => valueSelector.join('.')
const parseValueSelector = (value: string): ValueSelector => value.split('.').filter(Boolean)

/**
 * VariableSelect 变量选择器
 */
const VariableSelect: React.FC<{
  value: ValueSelector
  options: VariableOption[]
  onChange: (value: ValueSelector) => void
  placeholder: string
}> = ({ value, options, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const listboxId = useId()
  const serializedValue = serializeValueSelector(value)
  const selectedOption = useMemo(
    () => options.find(option => serializeValueSelector(option.valueSelector) === serializedValue) ?? null,
    [options, serializedValue],
  )

  useEffect(() => {
    if (!isOpen)
      return undefined

    const handlePointerDown = (event: MouseEvent) => {
      if (wrapperRef.current?.contains(event.target as Node))
        return

      setIsOpen(false)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        setIsOpen(false)
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div ref={wrapperRef} className="relative w-full">
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        className={cn(
          panelControlClassName,
          'flex items-center justify-between bg-white pr-2.5 text-left',
          isOpen && 'border-[#5b7cff] bg-white',
        )}
        onClick={() => setIsOpen(open => !open)}
      >
        <span className={cn('truncate', !selectedOption && 'text-slate-400')}>
          {selectedOption?.label ?? placeholder}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className={cn('shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-56 overflow-y-auto rounded-[12px] border border-slate-200 bg-white p-1 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.38)]"
        >
          <button
            type="button"
            role="option"
            aria-selected={serializedValue === ''}
            className={cn(
              'flex w-full items-center rounded-[10px] px-2.5 py-2 text-left text-[12px] transition',
              serializedValue === ''
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
            )}
            onClick={() => {
              onChange([])
              setIsOpen(false)
            }}
          >
            {placeholder}
          </button>
          {options.map((option) => {
            const serializedOption = serializeValueSelector(option.valueSelector)

            return (
              <button
                key={serializedOption}
                type="button"
                role="option"
                aria-selected={serializedOption === serializedValue}
                className={cn(
                  'flex w-full items-center rounded-[10px] px-2.5 py-2 text-left text-[12px] transition',
                  serializedOption === serializedValue
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
                onClick={() => {
                  onChange(parseValueSelector(serializedOption))
                  setIsOpen(false)
                }}
              >
                <span className="truncate">{option.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default VariableSelect
