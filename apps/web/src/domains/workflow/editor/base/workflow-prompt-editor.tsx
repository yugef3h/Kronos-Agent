import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

import { IconBraceVar } from '../config-page/chatbot-prompt-editor'
import type { ValueSelector, VariableOption } from '../panels/llm-panel/types'
import { cn } from '../utils/classnames'
import {
  formatWorkflowVariableToken,
  resolveWorkflowVariableMenuTrigger,
  WORKFLOW_PROMPT_VARIABLE_HIGHLIGHT_RE,
  type WorkflowVariableMenuTrigger,
} from '../utils/workflow-prompt-variable-utils'
import {
  buildWorkflowVariableMenuGroups,
  GROUP_TONE_STYLES,
} from '../utils/workflow-variable-menu-groups'

const rowClass = 'text-[12px] leading-5'
const padClass = 'px-2 py-1.5'

const menuRowClass =
  'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-normal text-slate-800 transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none'

function measureCaretClientRect(textarea: HTMLTextAreaElement, position: number): DOMRect {
  const cs = getComputedStyle(textarea)
  const taRect = textarea.getBoundingClientRect()
  const borderTop = parseFloat(cs.borderTopWidth) || 0
  const borderLeft = parseFloat(cs.borderLeftWidth) || 0
  const mirrorContent = [
    'position:absolute',
    'left:0',
    `top:${-textarea.scrollTop}px`,
    `width:${textarea.clientWidth}px`,
    'white-space:pre-wrap',
    'overflow-wrap:break-word',
    'word-break:break-word',
    `font:${cs.font}`,
    `line-height:${cs.lineHeight}`,
    `letter-spacing:${cs.letterSpacing}`,
    `padding:${cs.padding}`,
    'box-sizing:border-box',
    `text-align:${cs.textAlign}`,
    `direction:${cs.direction}`,
    'border:0',
    'margin:0',
  ].join(';')

  const clip = document.createElement('div')
  clip.setAttribute(
    'style',
    [
      'position:fixed',
      `top:${taRect.top + borderTop}px`,
      `left:${taRect.left + borderLeft}px`,
      `width:${textarea.clientWidth}px`,
      `height:${textarea.clientHeight}px`,
      'z-index:-1',
      'visibility:hidden',
      'overflow:hidden',
      'pointer-events:none',
    ].join(';'),
  )

  const inner = document.createElement('div')
  inner.setAttribute('style', mirrorContent)
  inner.textContent = textarea.value.slice(0, position)
  const span = document.createElement('span')
  span.textContent = textarea.value.slice(position) || ' '
  inner.appendChild(span)
  clip.appendChild(inner)
  document.body.appendChild(clip)
  const r = span.getBoundingClientRect()
  document.body.removeChild(clip)
  return r
}

function highlightNodes(text: string): ReactNode[] {
  const re = new RegExp(WORKFLOW_PROMPT_VARIABLE_HIGHLIGHT_RE.source, 'g')
  const nodes: ReactNode[] = []
  let last = 0
  let key = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index))
    }

    nodes.push(
      <span key={`wf-pv-hl-${key++}`} className="font-medium text-[#155EEF]">
        {match[0]}
      </span>,
    )
    last = match.index + match[0].length
  }

  nodes.push(text.slice(last))
  return nodes
}

export type WorkflowPromptEditorProps = {
  id?: string
  value: string
  onChange: (next: string) => void
  variableOptions: VariableOption[]
  rows?: number
  placeholder?: string
  className?: string
}

export const WorkflowPromptEditor = ({
  id,
  value,
  onChange,
  variableOptions,
  rows = 4,
  placeholder = '在这里写提示词；输入 { 或 / 插入上游变量。',
  className,
}: WorkflowPromptEditorProps) => {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const hlRef = useRef<HTMLDivElement>(null)
  const valueRef = useRef(value)
  const selEndRef = useRef(0)

  const [menu, setMenu] = useState<WorkflowVariableMenuTrigger | null>(null)
  const [menuScreenPos, setMenuScreenPos] = useState<{ top: number; left: number } | null>(null)
  const menuRef = useRef(menu)
  menuRef.current = menu

  useEffect(() => {
    valueRef.current = value
  }, [value])

  const syncScroll = useCallback(() => {
    const ta = taRef.current
    const hl = hlRef.current
    if (ta && hl) {
      hl.scrollTop = ta.scrollTop
      hl.scrollLeft = ta.scrollLeft
    }
  }, [])

  useLayoutEffect(() => {
    const ta = taRef.current
    const hl = hlRef.current
    if (ta && hl) {
      hl.style.height = `${ta.scrollHeight}px`
    }
    syncScroll()
  }, [value, syncScroll])

  const recomputeMenuScreenPos = useCallback(() => {
    const ta = taRef.current
    if (!ta || !menuRef.current) {
      setMenuScreenPos(null)
      return
    }

    const caretIndex = ta.selectionStart ?? 0
    const r = measureCaretClientRect(ta, caretIndex)
    const gap = 3
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
    const menuMinW = 240
    const left = Math.min(r.left, Math.max(8, vw - menuMinW - 12))
    setMenuScreenPos({ top: r.bottom + gap, left })
  }, [])

  useLayoutEffect(() => {
    if (!menu) {
      setMenuScreenPos(null)
      return
    }

    recomputeMenuScreenPos()
  }, [menu, value, recomputeMenuScreenPos])

  useEffect(() => {
    if (!menuRef.current) {
      return undefined
    }

    const onWin = () => recomputeMenuScreenPos()
    window.addEventListener('scroll', onWin, true)
    window.addEventListener('resize', onWin)
    return () => {
      window.removeEventListener('scroll', onWin, true)
      window.removeEventListener('resize', onWin)
    }
  }, [menu, recomputeMenuScreenPos])

  const openMenuIfAny = useCallback((nextVal: string, sel: number) => {
    setMenu(resolveWorkflowVariableMenuTrigger(nextVal, sel))
  }, [])

  const commitInsert = (selector: ValueSelector) => {
    if (!menu || !taRef.current) {
      return
    }

    const ta = taRef.current
    const end = Math.max(selEndRef.current, ta.selectionStart ?? 0)
    const currentValue = valueRef.current
    const token = formatWorkflowVariableToken(selector)
    let next: string
    let pos: number

    if (menu.kind === 'pair') {
      next = `${currentValue.slice(0, menu.openStart)}${token}${currentValue.slice(menu.replaceEnd)}`
      pos = menu.openStart + token.length
    } else {
      next = `${currentValue.slice(0, menu.start)}${token}${currentValue.slice(end)}`
      pos = menu.start + token.length
    }

    valueRef.current = next
    onChange(next)
    setMenu(null)
    setMenuScreenPos(null)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(pos, pos)
    })
  }

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value
    const sel = event.target.selectionStart ?? nextValue.length
    selEndRef.current = event.target.selectionEnd ?? sel
    valueRef.current = nextValue
    onChange(nextValue)
    openMenuIfAny(nextValue, sel)
    syncScroll()
  }

  const handleKeyUp = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = event.currentTarget
    syncScroll()
    openMenuIfAny(ta.value, ta.selectionStart ?? 0)
  }

  const handleSelect = () => {
    const ta = taRef.current
    if (ta) {
      selEndRef.current = ta.selectionEnd ?? ta.selectionStart ?? 0
    }

    syncScroll()
    if (menuRef.current) {
      requestAnimationFrame(() => recomputeMenuScreenPos())
    }
  }

  const handleBlur = () => {
    setMenu(null)
    setMenuScreenPos(null)
  }

  const menuGroups = buildWorkflowVariableMenuGroups(variableOptions, menu?.filter ?? '')
  const hasMenuOptions = menuGroups.some((group) => group.options.length > 0)

  return (
    <div className={cn('relative min-w-0', className)}>
      <div className="relative min-w-0">
        <textarea
          ref={taRef}
          id={id}
          rows={rows}
          value={value}
          spellCheck={false}
          onChange={handleChange}
          onKeyUp={handleKeyUp}
          onSelect={handleSelect}
          onScroll={() => {
            syncScroll()
            recomputeMenuScreenPos()
          }}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            rowClass,
            padClass,
            'relative z-10 min-h-[72px] w-full min-w-0 resize-y overflow-auto rounded-lg border border-slate-200 bg-transparent text-transparent caret-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100',
            '[-webkit-text-fill-color:transparent]',
          )}
        />
        <div
          ref={hlRef}
          className={cn(
            rowClass,
            padClass,
            'pointer-events-none absolute left-0 top-0 z-0 min-h-[72px] w-full min-w-0 overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-transparent bg-white font-normal text-slate-700',
          )}
          aria-hidden
        >
          {highlightNodes(value)}
        </div>

        {menu && menuScreenPos ? (
          <div
            className="flex max-h-72 min-w-[240px] max-w-[min(320px,calc(100vw-16px))] flex-col overflow-hidden rounded-[10px] border border-slate-200/90 bg-white shadow-[0_8px_28px_-6px_rgba(15,23,42,0.14)]"
            style={{
              position: 'fixed',
              top: menuScreenPos.top,
              left: menuScreenPos.left,
              zIndex: 1003,
            }}
            onMouseDown={(event) => event.preventDefault()}
            role="listbox"
            aria-label="插入工作流变量"
          >
            {hasMenuOptions ? (
              <div className="overflow-y-auto overflow-x-hidden p-1">
                {menuGroups.map((group) => (
                  <div key={group.key} className="py-0.5">
                    <p className={cn('px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide', GROUP_TONE_STYLES[group.tone])}>
                      {group.title}
                    </p>
                    {group.options.map((option) => (
                      <button
                        key={option.path}
                        type="button"
                        role="option"
                        className={menuRowClass}
                        onClick={() => commitInsert(option.valueSelector)}
                      >
                        <IconBraceVar className="h-5 w-5 text-[9px]" />
                        <span className="min-w-0 flex-1 truncate font-medium">{option.displayLabel}</span>
                        <span className="shrink-0 text-[10px] text-slate-400">{option.typeLabel}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-3 py-2.5 text-[11px] text-slate-500">暂无匹配的上游变量</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
