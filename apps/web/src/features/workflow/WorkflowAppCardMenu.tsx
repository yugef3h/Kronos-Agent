import { useEffect, useRef, useState } from 'react';

type WorkflowAppCardMenuProps = {
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

export const WorkflowAppCardMenu = ({ onEdit, onDelete }: WorkflowAppCardMenuProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => document.removeEventListener('mousedown', onDocumentMouseDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative shrink-0 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <button
        type="button"
        aria-label="更多操作"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/90 bg-slate-50 text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-700"
      >
        <VerticalDotsIcon />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 bottom-full z-20 mb-1 min-w-[7.5rem] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.28)]"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
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
            className="block w-full px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              onDelete();
            }}
          >
            删除
          </button>
        </div>
      ) : null}
    </div>
  );
};
