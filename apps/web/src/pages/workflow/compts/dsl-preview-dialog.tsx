import { useMemo, useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '../base/dialog';

type DslPreviewDialogProps = {
  appId: string;
  appName?: string;
  dsl: unknown;
  nodeCount: number;
  edgeCount: number;
};

export default function DslPreviewDialog({
//   appId,
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
        <svg
          viewBox="0 0 1024 1024"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          p-id="6734"
          width="16"
          height="16"
        >
          <path
            d="M747.392 736.192a34.88 34.88 0 0 1-24.768-59.712l153.856-153.856-153.408-153.408a35.008 35.008 0 0 1 49.536-49.536l178.176 178.176a35.008 35.008 0 0 1 0 49.472l-178.624 178.56a34.88 34.88 0 0 1-24.768 10.24z m-463.744 0a34.944 34.944 0 0 1-24.704-10.24l-178.624-178.56a35.008 35.008 0 0 1 0-49.536l178.112-178.176a35.008 35.008 0 0 1 49.536 49.536L154.56 522.624l153.856 153.856a35.008 35.008 0 0 1-24.768 59.712zM427.52 886.4a35.008 35.008 0 0 1-33.92-44.032L570.752 181.632a35.008 35.008 0 0 1 67.648 18.112L461.312 860.416a35.008 35.008 0 0 1-33.792 25.92z"
            p-id="6735"
          ></path>
        </svg>
        <span>DSL</span>
      </button>

      <DialogContent className="h-[min(84dvh,860px)] w-[min(960px,calc(100vw-2rem))] max-w-[min(960px,calc(100vw-2rem))] overflow-hidden p-0">
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-[#fcfaf5]">
          <div className="relative border-b border-[#e6dfd2] bg-[radial-gradient(circle_at_top_left,#fff9ec_0%,#f4ecdd_42%,#ece3d2_100%)] px-5 py-5 text-slate-900">
            <div className="pr-32">
              <DialogTitle>
                <span className="block text-[16px] font-semibold tracking-[-0.02em] text-[#1f2937]">
                  {appName}
                </span>
              </DialogTitle>
              {/* <p className="mt-1 text-sm text-slate-600">
                {appName ? `${appName} · ` : ''}应用 ID：{appId}
              </p> */}
            </div>

            <div className="absolute right-5 top-4">
              <DialogClose className="flex p-2 items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold text-slate-700 shadow-[0_14px_24px_-20px_rgba(15,23,42,0.5)] hover:border-[#c7bfb1] hover:bg-[#f8f5ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6c7ab]">
                <svg
                  viewBox="0 0 1024 1024"
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  p-id="4757"
                  width="16"
                  height="16"
                >
                  <path
                    d="M512 466.944l233.472-233.472a31.744 31.744 0 0 1 45.056 45.056L557.056 512l233.472 233.472a31.744 31.744 0 0 1-45.056 45.056L512 557.056l-233.472 233.472a31.744 31.744 0 0 1-45.056-45.056L466.944 512 233.472 278.528a31.744 31.744 0 0 1 45.056-45.056z"
                    fill="#5A5A68"
                    p-id="4758"
                  ></path>
                </svg>
              </DialogClose>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-[#ebe4d7] bg-[#f7f3eb] px-5 py-3">
            <span className="rounded-full border border-[#e1d9cb] bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              Nodes={nodeCount}
            </span>
            <span className="rounded-full border border-[#e1d9cb] bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              Edges={edgeCount}
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
