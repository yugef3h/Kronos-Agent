import { type MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../domains/workflow/editor/utils/classnames';

const stopCardNavigation = (event: ReactMouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

type KnowledgeDatasetCardMenuProps = {
  datasetName: string;
  className?: string;
  disabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

const VerticalDotsIcon = () => (
  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
    <circle cx="8" cy="3.25" r="1.25" />
    <circle cx="8" cy="8" r="1.25" />
    <circle cx="8" cy="12.75" r="1.25" />
  </svg>
);

export const KnowledgeDatasetCardMenu = ({
  datasetName,
  className,
  disabled = false,
  onEdit,
  onDelete,
}: KnowledgeDatasetCardMenuProps) => {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocumentMouseDown = (event: globalThis.MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => document.removeEventListener('mousedown', onDocumentMouseDown);
  }, [open]);

  return (
    <>
      <div
        ref={rootRef}
        className={cn(
          'relative shrink-0 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100',
          className,
        )}
        onClick={stopCardNavigation}
        onMouseDown={stopCardNavigation}
      >
        <button
          type="button"
          aria-label="更多操作"
          aria-expanded={open}
          aria-haspopup="menu"
          disabled={disabled}
          onClick={(event) => {
            stopCardNavigation(event);
            setOpen((current) => !current);
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/90 bg-slate-50 text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <VerticalDotsIcon />
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute right-0 bottom-full z-20 mb-1 min-w-[7.5rem] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.28)]"
            onClick={stopCardNavigation}
            onMouseDown={stopCardNavigation}
          >
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={(event) => {
                stopCardNavigation(event);
                setOpen(false);
                onEdit();
              }}
            >
              编辑信息
            </button>
            <div className="mx-2 my-1 h-px bg-slate-100" role="separator" />
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              className="block w-full px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={(event) => {
                stopCardNavigation(event);
                setOpen(false);
                setConfirmOpen(true);
              }}
            >
              删除
            </button>
          </div>
        ) : null}
      </div>

      {confirmOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/35 px-3"
              onClick={(event) => {
                stopCardNavigation(event);
                setConfirmOpen(false);
              }}
              onMouseDown={stopCardNavigation}
              role="presentation"
            >
              <div
                className="w-full max-w-sm rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_24px_48px_-24px_rgba(15,23,42,0.35)]"
                onClick={stopCardNavigation}
                onMouseDown={stopCardNavigation}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="knowledge-dataset-delete-title"
              >
                <h3 id="knowledge-dataset-delete-title" className="text-base font-semibold text-slate-900">
                  删除知识库？
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  确定删除「{datasetName}」？此操作不可恢复。
                </p>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      stopCardNavigation(event);
                      setConfirmOpen(false);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={(event) => {
                      stopCardNavigation(event);
                      setConfirmOpen(false);
                      onDelete();
                    }}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
};
