import React from 'react';

/**
 * InfoTooltip 轻量信息提示浮层，hover 或 focus 时显示
 */
const InfoTooltip: React.FC<{ content: string }> = ({ content }) => (
  <div className="group relative inline-flex items-center">
    <button
      type="button"
      aria-label={content}
      className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white text-[10px] font-semibold leading-none text-slate-500 transition hover:border-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
    >
      <svg
        viewBox="0 0 1024 1024"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        p-id="5625"
        width="16"
        height="16"
      >
        <path
          d="M512 128c212 0 384 172 384 384s-172 384-384 384-384-172-384-384 172-384 384-384m0-64C264.8 64 64 264.8 64 512s200.8 448 448 448 448-200.8 448-448S759.2 64 512 64z m32 704h-64v-64h64v64z m11.2-203.2l-5.6 4.8c-3.2 2.4-5.6 8-5.6 12.8v58.4h-64v-58.4c0-24.8 11.2-48 29.6-63.2l5.6-4.8c56-44.8 83.2-68 83.2-108C598.4 358.4 560 320 512 320c-49.6 0-86.4 36.8-86.4 86.4h-64C361.6 322.4 428 256 512 256c83.2 0 150.4 67.2 150.4 150.4 0 72.8-49.6 112.8-107.2 158.4z"
          p-id="5626"
          fill="#bfbfbf"
        ></path>
      </svg>
    </button>
    <div className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 w-max max-w-[220px] -translate-y-1/2 rounded-lg bg-white px-2 py-1 text-[10px] leading-4 text-slate-900 opacity-0 shadow-md transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
      {content}
    </div>
  </div>
);

export default InfoTooltip;
