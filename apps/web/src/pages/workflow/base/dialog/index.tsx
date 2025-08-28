'use client'

//   z-index strategy (relies on root `isolation: isolate` in layout.tsx):
//   All base/ui/* overlay primitives — z-[1002]
//   Overlays share the same z-index; DOM order handles stacking when multiple are open.
//   This ensures overlays inside a Dialog (e.g. a Tooltip on a dialog button) render
//   above the dialog backdrop instead of being clipped by it.
//   During migration, z-[1002] is chosen to sit above all legacy overlays
//   (Modal z-[60], PortalToFollowElem callers up to z-[1001]).
//   Once all legacy overlays are migrated, this can be reduced back to z-50.
//   Toast — z-[9999], always on top (defined in toast component)

import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import * as React from 'react'
import { cn } from '../../utils/classnames'

export const Dialog = BaseDialog.Root
export const DialogTrigger = BaseDialog.Trigger
export const DialogTitle = BaseDialog.Title
export const DialogDescription = BaseDialog.Description
export const DialogClose = BaseDialog.Close
export const DialogPortal = BaseDialog.Portal

type DialogCloseButtonProps = Omit<React.ComponentPropsWithoutRef<typeof BaseDialog.Close>, 'children'>

export function DialogCloseButton({
  className,
  'aria-label': ariaLabel = 'Close',
  ...props
}: DialogCloseButtonProps) {
  return (
    <BaseDialog.Close
      aria-label={ariaLabel}
      {...props}
      className={cn(
        'absolute right-6 top-6 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </BaseDialog.Close>
  )
}

type DialogContentProps = {
  children: React.ReactNode
  className?: string
  overlayClassName?: string
}

export function DialogContent({
  children,
  className,
  overlayClassName,
}: DialogContentProps) {
  return (
    <DialogPortal>
      <BaseDialog.Backdrop
        className={cn(
          'fixed inset-0 z-[1002] bg-background-overlay',
          'transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none',
          overlayClassName,
        )}
      />
      <BaseDialog.Popup
        className={cn(
          'fixed left-1/2 top-1/2 z-[1002] max-h-[80dvh] w-[480px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl border-[0.5px] border-components-panel-border bg-components-panel-bg p-6 shadow-xl',
          'transition-[transform,scale,opacity] duration-150 data-[ending-style]:scale-95 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none',
          className,
        )}
      >
        {children}
      </BaseDialog.Popup>
    </DialogPortal>
  )
}
