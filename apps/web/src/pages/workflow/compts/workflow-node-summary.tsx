import type { CanvasNodeData } from '../types/canvas'
import {
  buildWorkflowNodeSummary,
  type WorkflowNodeSummaryTone,
} from '../utils/workflow-node-summary'

const tagToneClassName = (tone: WorkflowNodeSummaryTone = 'slate') => {
  if (tone === 'blue')
    return 'border-blue-100 bg-blue-50 text-blue-700'

  if (tone === 'amber')
    return 'border-amber-100 bg-amber-50 text-amber-700'

  return 'border-slate-200 bg-slate-50 text-slate-600'
}

const metaToneClassName = (tone: WorkflowNodeSummaryTone = 'slate') => {
  if (tone === 'blue')
    return 'text-blue-600'

  if (tone === 'amber')
    return 'text-amber-700'

  return 'text-slate-400'
}

export const WorkflowNodeSummary = ({
  data,
  compact = false,
}: {
  data: CanvasNodeData
  compact?: boolean
}) => {
  const summary = buildWorkflowNodeSummary(data)

  if (!summary.tags.length && !summary.items.length)
    return null

  return (
    <div className={compact ? 'mt-1 space-y-1' : 'mt-2 space-y-1.5'}>
      {summary.tags.length ? (
        <div className="flex flex-wrap gap-1">
          {summary.tags.map(tag => (
            <span
              key={tag.text}
              className={`rounded-full border font-medium leading-none ${compact ? 'px-1.5 py-0.5 text-[8px]' : 'px-1.5 py-0.5 text-[9px]'} ${tagToneClassName(tag.tone)}`}
            >
              {tag.text}
            </span>
          ))}
        </div>
      ) : null}

      {summary.items.length ? (
        <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
          {summary.items.map(item => (
            <div
              key={`${item.primary}-${item.secondary ?? ''}-${item.meta ?? ''}`}
              className={`rounded-md border border-slate-200/70 bg-slate-50/75 ${compact ? 'px-1.5 py-1' : 'px-2 py-1'}`}
            >
              <div className="flex items-center gap-1.5">
                <div className="min-w-0 flex-1 truncate">
                  <span className={`truncate font-medium text-slate-700 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
                    {item.primary}
                  </span>
                  {item.secondary ? (
                    <span className={`ml-1 truncate text-slate-400 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
                      {`· ${item.secondary}`}
                    </span>
                  ) : null}
                </div>
                {item.meta ? (
                  <span className={`shrink-0 font-semibold leading-none ${compact ? 'text-[8px]' : 'text-[9px]'} ${metaToneClassName(item.tone)}`}>
                    {item.meta}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default WorkflowNodeSummary