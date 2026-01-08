import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { panelControlClassName } from './panel-form';
import { cn } from '../../domains/workflow/editor/utils/classnames';
import type { ValueSelector, VariableOption } from '../../domains/workflow/editor/panels/llm-panel/types';

const serializeValueSelector = (valueSelector: ValueSelector): string => valueSelector.join('.');
const parseValueSelector = (value: string): ValueSelector => value.split('.').filter(Boolean);

type VariableGroup = {
  key: string;
  title: string;
  tone: 'slate' | 'blue' | 'emerald' | 'amber';
  options: Array<VariableOption & { displayLabel: string; typeLabel: string }>;
};

const GROUP_TONE_STYLES: Record<VariableGroup['tone'], string> = {
  slate: 'text-slate-500',
  blue: 'text-blue-700',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
};

const resolveOptionDisplayLabel = (option: VariableOption) => {
  if (option.source === 'system') {
    return option.valueSelector[1] ?? option.label;
  }

  const separatorIndex = option.label.lastIndexOf('.');
  return separatorIndex >= 0 ? option.label.slice(separatorIndex + 1) : option.label;
};

const resolveGroupMeta = (option: VariableOption) => {
  if (option.source === 'system') {
    const variableKey = option.valueSelector[1] ?? '';
    if (variableKey === 'query' || variableKey === 'files') {
      return {
        key: 'user-input',
        title: '用户输入',
        tone: 'emerald' as const,
      };
    }

    return {
      key: 'system',
      title: 'SYSTEM',
      tone: 'amber' as const,
    };
  }

  const separatorIndex = option.label.lastIndexOf('.');
  const title = separatorIndex >= 0 ? option.label.slice(0, separatorIndex) : option.label;
  const normalizedTitle = title.toLowerCase();

  if (normalizedTitle.includes('llm')) {
    return {
      key: `node-${title}`,
      title,
      tone: 'blue' as const,
    };
  }

  if (title.includes('知识')) {
    return {
      key: `node-${title}`,
      title,
      tone: 'emerald' as const,
    };
  }

  return {
    key: `node-${title}`,
    title,
    tone: 'slate' as const,
  };
};

const resolveTypeLabel = (option: VariableOption) => {
  const variableKey = option.valueSelector[option.valueSelector.length - 1] ?? '';

  switch (option.valueType) {
    case 'string':
      return 'String';
    case 'number':
      return 'Number';
    case 'boolean':
      return 'Boolean';
    case 'object':
      return 'Object';
    case 'file':
      return variableKey.includes('files') ? 'Array[File]' : 'File';
    case 'array':
      return variableKey.includes('file') ? 'Array[File]' : 'Array[Object]';
    default:
      return option.valueType || 'String';
  }
};

const isCustomOptionLabel = (label: VariableOption['triggerLabel']): boolean =>
  label != null && typeof label !== 'string' && typeof label !== 'number';

const buildVariableGroups = (options: VariableOption[], searchText: string): VariableGroup[] => {
  const normalizedSearch = searchText.trim().toLowerCase();
  const groups = new Map<string, VariableGroup>();

  options.forEach((option) => {
    const displayLabel = resolveOptionDisplayLabel(option);
    const typeLabel = resolveTypeLabel(option);
    const groupMeta = resolveGroupMeta(option);
    const searchableText =
      `${groupMeta.title} ${displayLabel} ${typeLabel} ${option.label} ${option.valueSelector.join('.')}`.toLowerCase();

    if (normalizedSearch && !searchableText.includes(normalizedSearch)) {
      return;
    }

    const existingGroup = groups.get(groupMeta.key);
    const groupedOption = {
      ...option,
      displayLabel,
      typeLabel,
    };

    if (existingGroup) {
      existingGroup.options.push(groupedOption);
      return;
    }

    groups.set(groupMeta.key, {
      ...groupMeta,
      options: [groupedOption],
    });
  });

  return Array.from(groups.values());
};

/**
 * VariableSelect 变量选择器（与编排侧 `panelControlClassName` 视觉一致）
 */
const VariableSelect: React.FC<{
  value: ValueSelector;
  options: VariableOption[];
  onChange: (value: ValueSelector) => void;
  placeholder: string;
  openSignal?: string | null;
  onOpenChange?: (isOpen: boolean) => void;
  disabled?: boolean;
  className?: string;
  /** 与快捷胶囊按钮一致：h-8 + rounded-full + slate 边框/底色 */
  pillTrigger?: boolean;
  /** 为 true 时用右侧「×」替代下拉箭头，并需配合 `onClear` */
  showClear?: boolean;
  onClear?: () => void;
  /** 下拉列表单项 class，如 `py-2 min-h-9` 调高行高 */
  optionClassName?: string;
}> = ({
  value,
  options,
  onChange,
  placeholder,
  openSignal,
  onOpenChange,
  disabled = false,
  className,
  pillTrigger = false,
  showClear = false,
  onClear,
  optionClassName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [floatingStyle, setFloatingStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const listboxRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();
  const serializedValue = serializeValueSelector(value);
  const selectedOption = useMemo(
    () => options.find((option) => serializeValueSelector(option.valueSelector) === serializedValue) ?? null,
    [options, serializedValue],
  );
  const groupedOptions = useMemo(() => buildVariableGroups(options, searchText), [options, searchText]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!openSignal) {
      return;
    }

    setIsOpen(true);
  }, [openSignal]);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen) {
      setSearchText('');
      return;
    }

    searchInputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || disabled) {
      setFloatingStyle({});
      return undefined;
    }

    const wrap = wrapperRef.current;
    if (!wrap) {
      return undefined;
    }

    const margin = 8;
    const gap = 6;
    const minPanel = 160;

    const updateFloating = () => {
      const r = wrap.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = r.width;
      const left = Math.min(Math.max(margin, r.left), Math.max(margin, vw - width - margin));

      const spaceBelow = vh - r.bottom - gap - margin;
      const spaceAbove = r.top - gap - margin;
      const preferBelow = spaceBelow >= minPanel || spaceBelow >= spaceAbove;

      const maxH = Math.max(
        minPanel,
        Math.min(420, preferBelow ? spaceBelow : spaceAbove),
      );

      if (preferBelow) {
        setFloatingStyle({
          position: 'fixed',
          left,
          top: r.bottom + gap,
          width,
          maxHeight: maxH,
          zIndex: 80,
        });
      } else {
        setFloatingStyle({
          position: 'fixed',
          left,
          bottom: vh - r.top + gap,
          width,
          maxHeight: maxH,
          zIndex: 80,
        });
      }
    };

    updateFloating();

    const ro = new ResizeObserver(() => {
      updateFloating();
    });
    ro.observe(wrap);

    window.addEventListener('scroll', updateFloating, true);
    window.addEventListener('resize', updateFloating);

    const id = window.requestAnimationFrame(() => {
      updateFloating();
    });

    return () => {
      window.cancelAnimationFrame(id);
      ro.disconnect();
      window.removeEventListener('scroll', updateFloating, true);
      window.removeEventListener('resize', updateFloating);
    };
  }, [isOpen, disabled, groupedOptions.length, searchText]);

  const showClearControl = Boolean(showClear && onClear && !disabled);

  return (
    <div ref={wrapperRef} className={cn('relative w-full', disabled && 'pointer-events-none opacity-60', className)}>
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        disabled={disabled}
        className={cn(
          pillTrigger
            ? cn(
                'inline-flex h-8 w-full shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 pl-3 text-left text-xs font-medium text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60',
                showClearControl ? 'pr-9' : 'pr-3',
                isOpen && 'border-cyan-300 bg-cyan-50 text-cyan-800',
              )
            : cn(
                panelControlClassName,
                'relative flex items-center justify-between bg-white text-left',
                showClearControl ? 'pr-8 pl-2.5' : 'pr-2.5',
                isOpen && 'border-[#5b7cff] bg-white',
              ),
        )}
        onClick={() => {
          if (disabled) {
            return;
          }
          setIsOpen((open) => !open);
        }}
      >
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-left',
            !selectedOption && 'text-slate-400',
            selectedOption && isCustomOptionLabel(selectedOption.triggerLabel) && 'text-inherit',
          )}
        >
          {(selectedOption?.triggerLabel ?? selectedOption?.label) ?? placeholder}
        </span>
        {!showClearControl && (
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
        )}
      </button>
      {showClearControl && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="清除选择"
          className={cn(
            'absolute right-1 top-1/2 z-[1] flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200/90 hover:text-slate-800',
            pillTrigger ? 'right-1' : 'right-1.5',
          )}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsOpen(false);
            onClear?.();
          }}
        >
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden className="shrink-0">
            <path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {isOpen && !disabled && (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          style={floatingStyle}
          className="flex min-h-0 flex-col overflow-hidden rounded-[16px] border border-slate-200 bg-white p-2 shadow-[0_24px_44px_-28px_rgba(15,23,42,0.42)]"
        >
          <div className="mb-2 flex shrink-0 items-center gap-2 rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-slate-400" aria-hidden="true">
              <path
                d="M21 21L16.65 16.65M11 18C7.13401 18 4 14.866 4 11C4 7.13401 7.13401 4 11 4C14.866 4 18 7.13401 18 11C18 14.866 14.866 18 11 18Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              ref={searchInputRef}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="搜索"
              className="h-6 w-full border-0 bg-transparent p-0 text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
            {groupedOptions.length ? (
              groupedOptions.map((group) => (
                <section key={group.key} className="space-y-1">
                  <div
                    className={cn(
                      'px-2.5 pt-1.5 text-[11px] font-bold uppercase tracking-[0.04em]',
                      GROUP_TONE_STYLES[group.tone],
                    )}
                  >
                    {group.title}
                  </div>
                  <div className="space-y-1">
                    {group.options.map((option) => {
                      const serializedOption = serializeValueSelector(option.valueSelector);

                      return (
                        <button
                          key={serializedOption}
                          type="button"
                          role="option"
                          aria-selected={serializedOption === serializedValue}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-[12px] px-2.5 text-left text-[12px] transition',
                            optionClassName ?? 'py-[1px]',
                            serializedOption === serializedValue
                              ? 'bg-blue-50/80 text-slate-900 ring-1 ring-blue-100'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                          )}
                          onClick={() => {
                            onChange(parseValueSelector(serializedOption));
                            setIsOpen(false);
                          }}
                        >
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate font-semibold text-[10px]',
                              !isCustomOptionLabel(option.triggerLabel) && 'text-slate-800',
                            )}
                          >
                            {option.triggerLabel ?? option.displayLabel}
                          </span>
                          <span className={cn('shrink-0 text-[11px] font-medium')}>{option.typeLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            ) : (
              <div className="rounded-[12px] border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-[12px] text-slate-500">
                未找到匹配变量
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VariableSelect;
