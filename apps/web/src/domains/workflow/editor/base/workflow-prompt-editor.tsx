/**
 * 与 config-page/chatbot-prompt-editor.tsx 同构：输入 { 或 / 弹出上游变量下拉。
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import { IconBraceVar } from '../config-page/chatbot-prompt-editor'
import {
  resolvePromptVariableMenuTrigger,
  type PromptVariableMenuTrigger,
} from '../config-page/promptVariablesUtils'
import { PANEL_Z_INDEX } from '../layout-constants'
import type { ValueSelector, VariableOption } from '../panels/llm-panel/types'
import { cn } from '../utils/classnames'
import { serializeValueSelector } from '../utils/variable-options'
import { formatWorkflowVariableToken, WORKFLOW_PROMPT_VARIABLE_HIGHLIGHT_RE } from '../utils/workflow-prompt-variable-utils'
import {
  buildWorkflowVariableMenuGroups,
  GROUP_TONE_STYLES,
} from '../utils/workflow-variable-menu-groups'

const MENU_Z_INDEX = PANEL_Z_INDEX + 40
const rowClass = 'text-[12px] leading-5'
const padClass = 'px-2 py-1.5'

const menuRowClass =
  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] font-normal text-[#1D2939] transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none'

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
  let k = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index))
    }
    nodes.push(
      <span key={`wf-pv-hl-${k++}`} className="font-normal text-[#155EEF]">
        {m[0]}
      </span>,
    )
    last = m.index + m[0].length
  }
  nodes.push(text.slice(last))
  return nodes
}

export type WorkflowPromptEditorHandle = {
  insertVariable: (selector: ValueSelector) => void
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

export const WorkflowPromptEditor = forwardRef<WorkflowPromptEditorHandle, WorkflowPromptEditorProps>(({
  id,
  value,
  onChange,
  variableOptions,
  rows = 4,
  placeholder = '在这里写提示词；输入 { 或 / 打开变量补全。',
  className,
}, ref) => {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const hlRef = useRef<HTMLDivElement>(null)
  const valueRef = useRef(value)
  const selEndRef = useRef(0)
  const blurTimerRef = useRef<number | null>(null)
  const syncTimerRef = useRef<number | null>(null)

  const [draft, setDraft] = useState(value)
  const [menu, setMenu] = useState<PromptVariableMenuTrigger | null>(null)
  const [menuScreenPos, setMenuScreenPos] = useState<{ top: number; left: number } | null>(null)
  const menuRef = useRef(menu)
  menuRef.current = menu

  useEffect(() => {
    setDraft(value)
    valueRef.current = value
  }, [value])

  useEffect(() => () => {
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current)
    }
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current)
    }
  }, [])

  const scheduleParentSync = useCallback((next: string) => {
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current)
    }
    syncTimerRef.current = window.setTimeout(() => {
      onChange(next)
      syncTimerRef.current = null
    }, 150)
  }, [onChange])

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
  }, [draft, syncScroll])

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
    const menuMinW = 220
    const left = Math.min(r.left, Math.max(8, vw - menuMinW - 12))
    setMenuScreenPos({ top: r.bottom + gap, left })
  }, [])

  useLayoutEffect(() => {
    if (!menu) {
      setMenuScreenPos(null)
      return
    }
    recomputeMenuScreenPos()
  }, [menu, draft, recomputeMenuScreenPos])

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
    if (!variableOptions.length) {
      setMenu(null)
      return
    }
    setMenu(resolvePromptVariableMenuTrigger(nextVal, sel))
  }, [variableOptions.length])

  const commitInsertAt = useCallback((selector: ValueSelector, replaceMenu: PromptVariableMenuTrigger | null) => {
    const ta = taRef.current
    if (!ta) {
      return
    }

    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current)
      blurTimerRef.current = null
    }

    const end = Math.max(selEndRef.current, ta.selectionStart ?? 0)
    const currentValue = valueRef.current
    const token = formatWorkflowVariableToken(selector)
    let next: string
    let pos: number

    if (replaceMenu?.kind === 'pair') {
      next = `${currentValue.slice(0, replaceMenu.openStart)}${token}${currentValue.slice(replaceMenu.replaceEnd)}`
      pos = replaceMenu.openStart + token.length
    } else if (replaceMenu?.kind === 'single') {
      next = `${currentValue.slice(0, replaceMenu.start)}${token}${currentValue.slice(end)}`
      pos = replaceMenu.start + token.length
    } else {
      next = `${currentValue.slice(0, end)}${token}${currentValue.slice(end)}`
      pos = end + token.length
    }

    valueRef.current = next
    setDraft(next)
    scheduleParentSync(next)
    setMenu(null)
    setMenuScreenPos(null)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(pos, pos)
      selEndRef.current = pos
    })
  }, [scheduleParentSync])

  useImperativeHandle(ref, () => ({
    insertVariable: (selector: ValueSelector) => {
      commitInsertAt(selector, menuRef.current)
    },
  }), [commitInsertAt])

  const commitInsert = (selector: ValueSelector) => {
    commitInsertAt(selector, menu)
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    const sel = e.target.selectionStart ?? v.length
    selEndRef.current = e.target.selectionEnd ?? sel
    valueRef.current = v
    setDraft(v)
    scheduleParentSync(v)
    openMenuIfAny(v, sel)
    syncScroll()
  }

  const handleKeyUp = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
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
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current)
    }
    blurTimerRef.current = window.setTimeout(() => {
      setMenu(null)
      setMenuScreenPos(null)
      blurTimerRef.current = null
      onChange(valueRef.current)
    }, 200)
  }

  const handleFocus = () => {
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current)
      blurTimerRef.current = null
    }
  }

  const f = (menu?.filter ?? '').trim().toLowerCase()
  const menuGroups = buildWorkflowVariableMenuGroups(variableOptions, f)
  const hasMenuOptions = menuGroups.some((group) => group.options.length > 0)

  const menuPortal = menu && menuScreenPos ? (
    <div
      className="flex min-w-[240px] max-w-[min(320px,calc(100vw-16px))] flex-col rounded-[10px] border border-slate-200/90 bg-white shadow-[0_8px_28px_-6px_rgba(15,23,42,0.14)]"
      style={{
        position: 'fixed',
        top: menuScreenPos.top,
        left: menuScreenPos.left,
        zIndex: MENU_Z_INDEX,
      }}
      onMouseDown={(e) => e.preventDefault()}
      role="listbox"
      aria-label="插入变量"
    >
      {hasMenuOptions ? (
        <div className="max-h-72 overflow-y-auto overflow-x-hidden p-1">
          {menuGroups.map((group) => (
            <div key={group.key}>
              <p className={cn('px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide', GROUP_TONE_STYLES[group.tone])}>
                {group.title}
              </p>
              {group.options.map((option) => (
                <button
                  key={serializeValueSelector(option.valueSelector)}
                  type="button"
                  role="option"
                  className={menuRowClass}
                  onClick={() => commitInsert(option.valueSelector)}
                >
                  <IconBraceVar />
                  <span className="min-w-0 flex-1 truncate font-normal">{option.displayLabel}</span>
                  <span className="shrink-0 text-[10px] text-slate-400">{option.typeLabel}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="px-3 py-2.5 text-[11px] text-slate-500">暂无上游变量，请先连接 Start 或其它节点</p>
      )}
    </div>
  ) : null

  return (
    <div className={cn('relative min-w-0', className)}>
      <div className="relative min-w-0">
        <textarea
          ref={taRef}
          id={id}
          rows={rows}
          value={draft}
          spellCheck={false}
          onChange={handleChange}
          onKeyUp={handleKeyUp}
          onSelect={handleSelect}
          onFocus={handleFocus}
          onScroll={() => {
            syncScroll()
            recomputeMenuScreenPos()
          }}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            rowClass,
            padClass,
            'relative z-10 w-full min-w-0 resize-y overflow-auto rounded-lg border border-slate-200 bg-transparent text-transparent caret-[#1D2939] outline-none transition focus:border-sky-400 focus:ring-1 focus:ring-sky-300',
            '[-webkit-text-fill-color:transparent] [&::placeholder]:text-slate-400 [&::placeholder]:opacity-100 [&::placeholder]:[-webkit-text-fill-color:rgb(148,163,184)]',
          )}
        />
        <div
          ref={hlRef}
          className={cn(
            rowClass,
            padClass,
            'pointer-events-none absolute left-0 top-0 z-0 w-full overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-transparent bg-slate-50 font-normal text-[#1D2939] antialiased',
          )}
          aria-hidden
        >
          {highlightNodes(draft)}
        </div>
      </div>

      {typeof document !== 'undefined' && menuPortal
        ? createPortal(menuPortal, document.body)
        : null}
    </div>
  )
})

WorkflowPromptEditor.displayName = 'WorkflowPromptEditor'
