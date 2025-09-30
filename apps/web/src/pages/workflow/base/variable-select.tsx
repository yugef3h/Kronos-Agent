import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { panelControlClassName } from './panel-form'
import { cn } from '../utils/classnames'
import type { ValueSelector, VariableOption } from '../features/llm-panel/types'

const serializeValueSelector = (valueSelector: ValueSelector): string => valueSelector.join('.')
const parseValueSelector = (value: string): ValueSelector => value.split('.').filter(Boolean)

type VariableGroup = {
  key: string
  title: string
  tone: 'slate' | 'blue' | 'emerald' | 'amber'
  options: Array<VariableOption & { displayLabel: string; typeLabel: string }>
}

// const TYPE_STYLES: Record<VariableOption['valueType'], { iconClassName: string; textClassName: string }> = {
//   string: {
//     iconClassName: 'border-blue-200 bg-blue-50 text-blue-600',
//     textClassName: 'text-blue-700',
//   },
//   number: {
//     iconClassName: 'border-violet-200 bg-violet-50 text-violet-600',
//     textClassName: 'text-violet-700',
//   },
//   boolean: {
//     iconClassName: 'border-cyan-200 bg-cyan-50 text-cyan-600',
//     textClassName: 'text-cyan-700',
//   },
//   array: {
//     iconClassName: 'border-emerald-200 bg-emerald-50 text-emerald-600',
//     textClassName: 'text-emerald-700',
//   },
//   object: {
//     iconClassName: 'border-amber-200 bg-amber-50 text-amber-600',
//     textClassName: 'text-amber-700',
//   },
//   file: {
//     iconClassName: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-600',
//     textClassName: 'text-fuchsia-700',
//   },
// }

const GROUP_TONE_STYLES: Record<VariableGroup['tone'], string> = {
  slate: 'text-slate-500',
  blue: 'text-blue-700',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
}

const resolveOptionDisplayLabel = (option: VariableOption) => {
  if (option.source === 'system') {
    return option.valueSelector[1] ?? option.label
  }

  const separatorIndex = option.label.lastIndexOf('.')
  return separatorIndex >= 0 ? option.label.slice(separatorIndex + 1) : option.label
}

const resolveGroupMeta = (option: VariableOption) => {
  if (option.source === 'system') {
    const variableKey = option.valueSelector[1] ?? ''
    if (variableKey === 'query' || variableKey === 'files') {
      return {
        key: 'user-input',
        title: '用户输入',
        tone: 'emerald' as const,
      }
    }

    return {
      key: 'system',
      title: 'SYSTEM',
      tone: 'amber' as const,
    }
  }

  const separatorIndex = option.label.lastIndexOf('.')
  const title = separatorIndex >= 0 ? option.label.slice(0, separatorIndex) : option.label
  const normalizedTitle = title.toLowerCase()

  if (normalizedTitle.includes('llm')) {
    return {
      key: `node-${title}`,
      title,
      tone: 'blue' as const,
    }
  }

  if (title.includes('知识')) {
    return {
      key: `node-${title}`,
      title,
      tone: 'emerald' as const,
    }
  }

  return {
    key: `node-${title}`,
    title,
    tone: 'slate' as const,
  }
}

const resolveTypeLabel = (option: VariableOption) => {
  const variableKey = option.valueSelector[option.valueSelector.length - 1] ?? ''

  switch (option.valueType) {
    case 'string':
      return 'String'
    case 'number':
      return 'Number'
    case 'boolean':
      return 'Boolean'
    case 'object':
      return 'Object'
    case 'file':
      return variableKey.includes('files') ? 'Array[File]' : 'File'
    case 'array':
      return variableKey.includes('file') ? 'Array[File]' : 'Array[Object]'
    default:
      return 'String'
  }
}

const buildVariableGroups = (options: VariableOption[], searchText: string): VariableGroup[] => {
  const normalizedSearch = searchText.trim().toLowerCase()
  const groups = new Map<string, VariableGroup>()

  options.forEach((option) => {
    const displayLabel = resolveOptionDisplayLabel(option)
    const typeLabel = resolveTypeLabel(option)
    const groupMeta = resolveGroupMeta(option)
    const searchableText = `${groupMeta.title} ${displayLabel} ${typeLabel} ${option.label} ${option.valueSelector.join('.')}`.toLowerCase()

    if (normalizedSearch && !searchableText.includes(normalizedSearch)) {
      return
    }

    const existingGroup = groups.get(groupMeta.key)
    const groupedOption = {
      ...option,
      displayLabel,
      typeLabel,
    }

    if (existingGroup) {
      existingGroup.options.push(groupedOption)
      return
    }

    groups.set(groupMeta.key, {
      ...groupMeta,
      options: [groupedOption],
    })
  })

  return Array.from(groups.values())
}

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
  const [searchText, setSearchText] = useState('')
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const listboxId = useId()
  const serializedValue = serializeValueSelector(value)
  const selectedOption = useMemo(
    () => options.find(option => serializeValueSelector(option.valueSelector) === serializedValue) ?? null,
    [options, serializedValue],
  )
  const groupedOptions = useMemo(
    () => buildVariableGroups(options, searchText),
    [options, searchText],
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

  useEffect(() => {
    if (!isOpen) {
      setSearchText('')
      return
    }

    searchInputRef.current?.focus()
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
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-[16px] border border-slate-200 bg-white p-2 shadow-[0_24px_44px_-28px_rgba(15,23,42,0.42)]"
        >
          <div className="mb-2 flex items-center gap-2 rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-slate-400" aria-hidden="true">
              <path d="M21 21L16.65 16.65M11 18C7.13401 18 4 14.866 4 11C4 7.13401 7.13401 4 11 4C14.866 4 18 7.13401 18 11C18 14.866 14.866 18 11 18Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              ref={searchInputRef}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="搜索变量"
              className="h-6 w-full border-0 bg-transparent p-0 text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {/* <button
              type="button"
              role="option"
              aria-selected={serializedValue === ''}
              className={cn(
                'flex w-full items-center justify-between rounded-[12px] px-2.5 py-2 text-left text-[12px] transition',
                serializedValue === ''
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
              onClick={() => {
                onChange([])
                setIsOpen(false)
              }}
            >
              <span className="truncate">{placeholder}</span>
            </button> */}

            {groupedOptions.length ? groupedOptions.map((group) => (
              <section key={group.key} className="space-y-1">
                <div className={cn('px-2.5 pt-1.5 text-[11px] font-bold uppercase tracking-[0.04em]', GROUP_TONE_STYLES[group.tone])}>
                  {group.title}
                </div>
                <div className="space-y-1">
                  {group.options.map((option) => {
                    const serializedOption = serializeValueSelector(option.valueSelector)

                    return (
                      <button
                        key={serializedOption}
                        type="button"
                        role="option"
                        aria-selected={serializedOption === serializedValue}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-[12px] px-2.5 py-[1px] text-left text-[12px] transition',
                          serializedOption === serializedValue
                            ? 'bg-blue-50/80 text-slate-900 ring-1 ring-blue-100'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                        )}
                        onClick={() => {
                          onChange(parseValueSelector(serializedOption))
                          setIsOpen(false)
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate font-semibold text-[10px] text-slate-800">
                          {option.displayLabel}
                        </span>
                        <span className={cn('shrink-0 text-[11px] font-medium')}>
                          {option.typeLabel}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )) : (
              <div className="rounded-[12px] border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-[12px] text-slate-500">
                未找到匹配变量
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default VariableSelect
