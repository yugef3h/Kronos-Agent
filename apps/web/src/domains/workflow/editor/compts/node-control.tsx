import type { FC } from 'react';
import { memo } from 'react';
import type { Node } from 'reactflow';

type NodeControlProps = Pick<Node, 'id'> & {
  isActive?: boolean;
  onDelete: (id: string) => void;
};

const NodeControl: FC<NodeControlProps> = ({ id, isActive = false, onDelete }) => {
  return (
    <div
      className={`absolute right-0 top-0 z-30 -translate-y-full pb-2 transition ${isActive ? 'pointer-events-auto visible opacity-100' : 'pointer-events-none invisible opacity-0 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100'}`}
    >
      <div className="flex items-center gap-1 rounded-lg bg-white px-1 py-1 shadow-md backdrop-blur-[5px]">
        <span className="flex h-4 w-4 items-center justify-center rounded-md text-slate-500">
          <svg
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            p-id="4751"
            width="12"
            height="12"
          >
            <path
              d="M264.3 141.6l275.4 179.3 284 184.8c1 0.6 3.6 2.4 3.6 6.7 0 4.3-2.6 6.1-3.6 6.7L539.8 704 264.3 883.3c-0.2-1-0.3-2.1-0.3-3.5V145.1c0-1.3 0.2-2.5 0.3-3.5M262 66.2c-36.5 0-70 32.9-70 78.9v734.6c0 46 33.5 78.9 70 78.9 11.6 0 23.6-3.3 34.8-10.7L579 764.2l284-184.8c48.5-31.6 48.5-102.5 0-134.1L579 260.5 296.9 76.9c-11.3-7.3-23.2-10.7-34.9-10.7z"
              fill="currentColor"
              p-id="4752"
            ></path>
          </svg>
        </span>

        <button
          type="button"
          aria-label="删除当前节点"
          className="flex h-4 w-4 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(id);
          }}
        >
          <svg
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            p-id="5733"
            width="14"
            height="14"
          >
            <path
              d="M556.8 512l262.4-262.4c12.8-12.8 12.8-32 0-44.8s-32-12.8-44.8 0L512 467.2 249.6 198.4c-12.8-6.4-38.4-6.4-51.2 0s-6.4 38.4 0 51.2L467.2 512l-262.4 262.4c-12.8 12.8-12.8 32 0 44.8 0 12.8 12.8 12.8 19.2 12.8s19.2 0 25.6-6.4L512 556.8l262.4 262.4c6.4 6.4 12.8 6.4 25.6 6.4s19.2 0 25.6-6.4c12.8-12.8 12.8-32 0-44.8L556.8 512z"
              fill="currentColor"
              p-id="5734"
            ></path>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default memo(NodeControl);
