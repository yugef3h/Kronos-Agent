import { useCallback, useEffect, useState } from 'react'
import { getWorkflowAppById, setWorkflowAppMockPublished } from '../../app/workflowAppStore'
import { useWorkflowDraftStore } from '../../../../store/workflowDraftStore'

type WorkflowMockPublishButtonProps = {
  appId: string | null | undefined
  compact?: boolean
  className?: string
}

export const WorkflowMockPublishButton = ({
  appId,
  compact = false,
  className = '',
}: WorkflowMockPublishButtonProps) => {
  const setPublishedAt = useWorkflowDraftStore((state) => state.setPublishedAt)
  const [mockPublished, setMockPublished] = useState(() => {
    if (!appId) {
      return false
    }

    return Boolean(getWorkflowAppById(appId)?.mockPublished)
  })

  useEffect(() => {
    if (!appId) {
      setMockPublished(false)
      return
    }

    setMockPublished(Boolean(getWorkflowAppById(appId)?.mockPublished))
  }, [appId])

  useEffect(() => {
    const onWorkflowAppsChanged = () => {
      if (!appId) {
        return
      }

      const app = getWorkflowAppById(appId)
      setMockPublished(Boolean(app?.mockPublished))
      setPublishedAt(app?.publishedAt ?? null)
    }

    window.addEventListener('kronos:workflow-apps-changed', onWorkflowAppsChanged)
    return () => window.removeEventListener('kronos:workflow-apps-changed', onWorkflowAppsChanged)
  }, [appId, setPublishedAt])

  const handleClick = useCallback(() => {
    if (!appId) {
      return
    }

    const next = !mockPublished
    const updated = setWorkflowAppMockPublished(appId, next)
    if (!updated) {
      return
    }

    setMockPublished(next)
    setPublishedAt(updated.publishedAt ?? null)
  }, [appId, mockPublished, setPublishedAt])

  const title = appId?.trim()
    ? '本地假发布：标记为已发布（仅本地，无真实云端发布）'
    : '缺少应用 ID'

  if (compact) {
    return (
      <button
        type="button"
        disabled={!appId}
        onClick={handleClick}
        title={title}
        className={`inline-flex h-8 shrink-0 items-center rounded-[10px] px-3 text-[12px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
          mockPublished
            ? 'bg-emerald-600 hover:bg-emerald-700'
            : 'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300'
        } ${className}`}
      >
        {mockPublished ? '已发布' : '发布'}
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={!appId}
      onClick={handleClick}
      title={title}
      className={`rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 ${
        mockPublished
          ? 'bg-emerald-600 hover:bg-emerald-700'
          : 'bg-blue-600 hover:bg-sky-700'
      } ${className}`}
    >
      {mockPublished ? '已发布（本地）' : '发布'}
    </button>
  )
}

export const WorkflowPublishedCheckBadge = () => (
  <span
    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-100"
    title="已发布（本地）"
    role="img"
    aria-label="已发布"
  >
    <svg
      viewBox="0 0 12 12"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 6.2 5.1 8.7 9.5 3.3" />
    </svg>
  </span>
)
