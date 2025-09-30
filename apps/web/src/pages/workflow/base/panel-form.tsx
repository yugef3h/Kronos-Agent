import type { ReactNode } from 'react'
import React from 'react'
import { cn } from '../utils/classnames'

export const panelControlClassName = 'h-8 w-full rounded-[10px] border border-[#e6ebf2] bg-[#f6f8fb] px-2.5 text-[12px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#5b7cff] focus:bg-white'

type PanelChoiceOption<T extends string> = {
  label: ReactNode
  value: T
  disabled?: boolean
}

type PanelChoiceGroupProps<T extends string> = {
  value: T
  options: PanelChoiceOption<T>[]
  onChange: (value: T) => void
  className?: string
  optionClassName?: string
  size?: 'sm' | 'md'
}

type PanelSliderInputProps = {
  value: number | null
  onChange: (value: number | null) => void
  min: number
  max: number
  step: number
  disabled?: boolean
  inputMin?: number
  inputMax?: number
  sliderClassName?: string
  inputClassName?: string
}

type PanelChoiceGroupField = {
  controlType: 'choiceGroup'
  value: string
  options: Array<PanelChoiceOption<string>>
  onChange: (value: string) => void
  className?: string
  optionClassName?: string
  size?: 'sm' | 'md'
}

type PanelNumberSliderField = {
  controlType: 'numberSlider'
  value: number | null
  onChange: (value: number | null) => void
  min: number
  max: number
  step: number
  disabled?: boolean
  inputMin?: number
  inputMax?: number
  sliderClassName?: string
  inputClassName?: string
}

export type PanelFieldControl = PanelChoiceGroupField | PanelNumberSliderField

export const PanelSection = ({
  title,
  aside,
  children,
  className,
  required,
}: {
  title?: string
  aside?: ReactNode
  children: ReactNode
  className?: string
  required?: boolean
}) => {
  return (
    <section className={cn('space-y-2 border-b border-slate-100 pb-3 last:border-b-0', className)}>
      <div className="flex items-center justify-between gap-3">
        {title && (
          <h3 className="text-[13px] font-semibold leading-5 text-slate-800">
            {title}
            {required && <span className="ml-0.5 align-middle text-[12px] font-semibold text-[#ff4d4f]">*</span>}
          </h3>
        )}
        {aside}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

export const PanelCard = ({ children, className }: { children: ReactNode; className?: string }) => {
  return (
    <div className={cn('rounded-[8px] border border-[#e9edf4] bg-[#f7f9fc] p-2.5', className)}>{children}</div>
  )
}

export const PanelToggle = ({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (!disabled)
          onChange(!checked)
      }}
      className={cn(
        'relative inline-flex h-[22px] w-[38px] items-center rounded-full border transition-all',
        checked
          ? 'border-[#2f66ff] bg-[#2f66ff] shadow-[0_6px_16px_rgba(47,102,255,0.22)]'
          : 'border-[#d8dfeb] bg-[#eef2f7]',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow-[0_2px_6px_rgba(15,23,42,0.18)] transition',
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  )
}

export const PanelInput = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => {
  return <input {...props} className={cn(panelControlClassName, className)} />
}

export const PanelTextarea = ({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => {
  return <textarea {...props} className={cn(panelControlClassName, 'min-h-[80px] resize-y py-2', className)} />
}

export const PanelSelect = ({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => {
  return (
    <div className="relative w-full">
      <select
        {...props}
        className={cn(panelControlClassName, 'appearance-none bg-white pr-8', className)}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  )
}

export const PanelChoiceGroup = <T extends string>({
  value,
  options,
  onChange,
  className,
  optionClassName,
  size = 'md',
}: PanelChoiceGroupProps<T>) => {
  const optionPaddingClassName = size === 'sm'
    ? 'px-2 py-1 text-[11px]'
    : 'px-3 py-1.5 text-[12px]'

  return (
    <div
      role="radiogroup"
      className={cn('inline-flex w-full rounded-[14px] border border-[#dbe3f2] bg-[#f4f7fb] p-1', className)}
    >
      {options.map(option => {
        const active = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            onClick={() => {
              if (!option.disabled)
                onChange(option.value)
            }}
            className={cn(
              'flex-1 rounded-[10px] font-semibold leading-5 transition',
              optionPaddingClassName,
              active
                ? 'bg-white text-[#2442a5] shadow-[0_8px_18px_rgba(79,111,255,0.18)]'
                : 'text-slate-500 hover:text-slate-700',
              option.disabled && 'cursor-not-allowed opacity-50',
              optionClassName,
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export const PanelSliderInput = ({
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  inputMin,
  inputMax,
  sliderClassName,
  inputClassName,
}: PanelSliderInputProps) => {
  const resolvedValue = value ?? min

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={resolvedValue}
        onChange={(event) => {
          const nextValue = Number(event.target.value)
          onChange(Number.isNaN(nextValue) ? null : nextValue)
        }}
        className={cn(
          'h-[3px] w-full cursor-pointer appearance-none rounded-full bg-[#dfe5f1] accent-[#2f66ff] disabled:cursor-not-allowed disabled:opacity-50',
          sliderClassName,
        )}
      />
      <input
        type="number"
        min={inputMin ?? min}
        max={inputMax ?? max}
        step={step}
        disabled={disabled}
        value={value ?? ''}
        onChange={(event) => {
          if (event.target.value === '') {
            onChange(null)
            return
          }

          const nextValue = Number(event.target.value)
          onChange(Number.isNaN(nextValue) ? null : nextValue)
        }}
        className={cn(
          'h-9 rounded-[14px] border border-transparent bg-[#eef2f7] px-3 text-center text-[12px] font-semibold text-slate-900 outline-none transition focus:border-[#5b7cff] focus:bg-white disabled:cursor-not-allowed disabled:opacity-50',
          inputClassName,
        )}
      />
    </div>
  )
}

export const PanelFieldRenderer = ({ field }: { field: PanelFieldControl }) => {
  if (field.controlType === 'numberSlider') {
    return (
      <PanelSliderInput
        min={field.min}
        max={field.max}
        step={field.step}
        disabled={field.disabled}
        value={field.value}
        onChange={field.onChange}
        inputMin={field.inputMin}
        inputMax={field.inputMax}
        sliderClassName={field.sliderClassName}
        inputClassName={field.inputClassName}
      />
    )
  }

  return (
    <PanelChoiceGroup
      value={field.value}
      options={field.options}
      onChange={field.onChange}
      className={field.className}
      optionClassName={field.optionClassName}
      size={field.size}
    />
  )
}

export const PanelToken = ({ children, className }: { children: ReactNode; className?: string }) => {
  return (
    <span className={cn('inline-flex items-center rounded-full border border-[#d9e2ff] bg-white px-2 py-0.5 text-[11px] font-medium leading-4 text-[#4f6fff]', className)}>
      {children}
    </span>
  )
}

export const PanelOutputVarRow = ({
  name,
  type,
  description,
}: {
  name: string
  type: string
  description: string
}) => {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2 text-[12px] font-semibold leading-5 text-slate-800">
        <span>{name}</span>
        <span className="text-[11px] font-medium text-slate-400">{type}</span>
      </div>
      <p className="text-[11px] leading-4 text-slate-500">{description}</p>
    </div>
  )
}

export default {
  PanelSection,
  PanelCard,
  PanelToggle,
  PanelInput,
  PanelSliderInput,
  PanelFieldRenderer,
  PanelTextarea,
  PanelSelect,
  PanelChoiceGroup,
  PanelToken,
  PanelOutputVarRow,
}