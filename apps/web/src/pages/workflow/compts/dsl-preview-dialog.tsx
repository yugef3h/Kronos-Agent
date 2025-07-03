import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogTitle,
} from '../base/dialog';

type DslPreviewDialogProps = {
  appId: string;
  appName?: string;
  dsl: unknown;
  nodeCount: number;
  edgeCount: number;
};

export default function DslPreviewDialog({
  appId,
  appName,
  dsl,
  nodeCount,
  edgeCount,
}: DslPreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const dslText = useMemo(() => JSON.stringify(dsl, null, 2), [dsl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(dslText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-[#d8d3c7] bg-[linear-gradient(180deg,#fffdf8_0%,#f5efe4_100%)] px-3 py-1.5 text-[12px] font-semibold text-[#4b5563] shadow-[0_12px_28px_-22px_rgba(120,113,108,0.8)] transition hover:border-[#c7bfb1] hover:text-[#1f2937]"
        onClick={() => setOpen(true)}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1f2937] text-[10px] font-bold text-white shadow-[0_10px_18px_-14px_rgba(31,41,55,0.9)]">
          {'{}'}
        </span>
        <span>查看 DSL</span>
      </button>

      <DialogContent className="h-[min(84dvh,860px)] w-[min(960px,calc(100vw-2rem))] max-w-[min(960px,calc(100vw-2rem))] overflow-hidden p-0">
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-[#fcfaf5]">
          <DialogCloseButton className="right-5 top-5 h-9 w-9 rounded-full border border-[#d8d3c7] bg-white text-slate-600 shadow-[0_14px_24px_-20px_rgba(15,23,42,0.5)] hover:border-[#c7bfb1] hover:bg-[#f8f5ed]" />

          <div className="relative border-b border-[#e6dfd2] bg-[radial-gradient(circle_at_top_left,#fff9ec_0%,#f4ecdd_42%,#ece3d2_100%)] px-5 py-5 text-slate-900">
            <div className="pr-28">
              <p className="mb-2 inline-flex rounded-full border border-[#ddd2be] bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a6b2d]">
                Workflow Snapshot
              </p>
              <DialogTitle>
                <span className="block text-[22px] font-semibold tracking-[-0.02em] text-[#1f2937]">
                  Workflow DSL Inspector
                </span>
              </DialogTitle>
              <p className="mt-1 text-sm text-slate-600">
                {appName ? `${appName} · ` : ''}应用 ID：{appId}
              </p>
            </div>

            <div className="absolute right-16 top-5">
              <DialogClose className="flex h-9 min-w-[92px] items-center justify-center gap-1.5 rounded-full border border-[#d8d3c7] bg-white px-3 text-[12px] font-semibold text-slate-700 shadow-[0_14px_24px_-20px_rgba(15,23,42,0.5)] transition hover:border-[#c7bfb1] hover:bg-[#f8f5ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6c7ab]">
                <span aria-hidden="true" className="i-ri-close-line h-4 w-4 text-slate-500" />
                <span>关闭</span>
              </DialogClose>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-[#ebe4d7] bg-[#f7f3eb] px-5 py-3">
            <span className="rounded-full border border-[#e1d9cb] bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              Nodes {nodeCount}
            </span>
            <span className="rounded-full border border-[#e1d9cb] bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              Edges {edgeCount}
            </span>
            <span className="rounded-full border border-[#e1d9cb] bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              JSON
            </span>
            <div className="ml-auto">
              <button
                type="button"
                className="rounded-full border border-[#d8d3c7] bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.4)] transition hover:border-[#c7bfb1] hover:bg-[#faf6ee]"
                onClick={handleCopy}
              >
                {copied ? '已复制' : '复制 JSON'}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-[linear-gradient(180deg,#f8f5ee_0%,#f3ede2_100%)] p-5">
            <div className="min-h-full rounded-[20px] border border-[#e2dacb] bg-[#fffdf9] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_40px_-34px_rgba(120,113,108,0.7)]">
              <pre className="min-h-full overflow-x-auto pb-8 font-mono text-[12px] leading-6 text-[#334155]">
                <code>{dslText}</code>
              </pre>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}