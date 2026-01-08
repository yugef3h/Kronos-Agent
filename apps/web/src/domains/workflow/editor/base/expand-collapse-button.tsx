import React from 'react';

/**
 * ExpandCollapseButton 展开/收起按钮
 */
const ExpandCollapseButton: React.FC<{
  expanded: boolean;
  onClick: () => void;
  labelExpand?: string;
  labelCollapse?: string;
}> = ({ expanded, onClick, labelExpand = '展开', labelCollapse = '收起' }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 pr-1.5 py-1 text-[11px] text-[#98a2b2] transition-all duration-200 hover:border-gray-300 hover:bg-gray-100 active:scale-95"
  >
    {expanded ? labelCollapse : labelExpand}
    <span
      className={`text-[10px] transition-transform duration-200 flex items-center justify-center ${expanded ? 'rotate-180' : ''}`}
    >
      <svg
        viewBox="0 0 1024 1024"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
      >
        <path
          d="M512 640l-181.034667-180.992 60.373334-60.330667L512 519.338667l120.661333-120.661334 60.373334 60.330667L512 640.042667z"
          fill="#98a2b2"
        ></path>
      </svg>
    </span>
  </button>
);

export default ExpandCollapseButton;
