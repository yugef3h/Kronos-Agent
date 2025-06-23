import type { ReactNode, RefObject } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconOutput } from '../assets/output';
import { IconLLM } from '../assets/llm';
import { IconKnowledge } from '../assets/knowledge';
import { IconCondition } from '../assets/condition';
import { IconIteration } from '../assets/iteration';
import { IconLoop } from '../assets/loop';
import type { AppendableNodeKind } from '../types/common';

// 节点类型定义（完全匹配截图分类）
type NodeCategory = {
  id: string;
  name: string;
  nodes: NodeItem[];
};

export type NodeItem = {
  id: string;
  name: string;
  icon: ReactNode;
  kind: AppendableNodeKind; // 复用你现有类型
};

const NODE_CATEGORIES: NodeCategory[] = [
  {
    id: 'all',
    name: '节点',
    nodes: [
      {
        id: 'llm',
        name: 'LLM',
        kind: 'llm',
        icon: <IconLLM />,
      },
      {
        id: 'knowledge',
        name: '知识检索',
        kind: 'knowledge',
        icon: <IconKnowledge />,
      },
      {
        id: 'end',
        name: '输出',
        kind: 'end',
        icon: <IconOutput />,
      },
      // {
      //   id: 'agent',
      //   name: 'Agent',
      //   kind: 'agent',
      //   icon: (
      //     <svg
      //       width="16"
      //       height="16"
      //       viewBox="0 0 16 16"
      //       fill="none"
      //       xmlns="http://www.w3.org/2000/svg"
      //       data-icon="Agent"
      //       aria-hidden="true"
      //     >
      //       <g id="agent">
      //         <g id="Vector">
      //           <path
      //             d="M14.7401 5.80454C14.5765 4.77996 14.1638 3.79808 13.5306 2.97273C12.8973 2.14738 12.0648 1.48568 11.1185 1.06589C10.1722 0.646098 9.12632 0.461106 8.08751 0.546487C7.05582 0.624753 6.04548 0.966277 5.17744 1.53548C4.3094 2.09758 3.58366 2.88024 3.09272 3.79808C2.59466 4.70881 2.33852 5.7405 2.33852 6.7793V7.22756L1.25703 9.3692C1.04357 9.80322 1.22145 10.3368 1.65547 10.5574L2.3314 10.8989V12.3006C2.3314 12.82 2.53063 13.3038 2.90061 13.6738C3.2706 14.0367 3.75442 14.243 4.27382 14.243H6.01702V14.7624C6.01702 15.1538 6.3372 15.4739 6.72853 15.4739C7.11986 15.4739 7.44004 15.1538 7.44004 14.7624V13.7094C7.44004 13.2185 7.04159 12.82 6.55065 12.82H4.27382C4.13864 12.82 4.00345 12.7631 3.91095 12.6706C3.81846 12.5781 3.76154 12.4429 3.76154 12.3077V10.5716C3.76154 10.2301 3.56943 9.92417 3.2706 9.77476L2.77254 9.52573L3.66904 7.73984C3.72596 7.61889 3.76154 7.4837 3.76154 7.34851V6.77219C3.76154 5.96818 3.96076 5.17129 4.34498 4.4669C4.72919 3.76251 5.28417 3.15772 5.9601 2.7237C6.63603 2.28968 7.41158 2.02643 8.20847 1.96239C9.00536 1.89835 9.81648 2.04066 10.5493 2.36795C11.2822 2.69524 11.9225 3.20042 12.4135 3.84077C12.8973 4.47402 13.2246 5.23533 13.3456 6.02511C13.4665 6.81488 13.3954 7.63312 13.125 8.38731C12.8617 9.12017 12.4206 9.78187 11.8585 10.3084C11.6735 10.4792 11.5668 10.7139 11.5668 10.9701V14.7624C11.5668 15.1538 11.887 15.4739 12.2783 15.4739C12.6696 15.4739 12.9898 15.1538 12.9898 14.7624V11.1978C13.6515 10.5432 14.1567 9.73918 14.4697 8.87114C14.8184 7.89637 14.918 6.83623 14.7615 5.81165L14.7401 5.80454Z"
      //             fill="currentColor"
      //           ></path>
      //           <path
      //             d="M10.8055 7.99599C10.8909 7.83234 10.962 7.66158 11.0189 7.4837H11.6522C12.0435 7.4837 12.3637 7.16352 12.3637 6.77219C12.3637 6.38086 12.0435 6.06068 11.6522 6.06068H11.0189C10.9691 5.8828 10.898 5.71204 10.8055 5.54839L11.2537 5.10014C11.5312 4.82266 11.5312 4.3744 11.2537 4.09692C10.9762 3.81943 10.528 3.81943 10.2505 4.09692L9.80225 4.54517C9.6386 4.45267 9.46784 4.38863 9.28996 4.33171V3.69847C9.28996 3.30714 8.96978 2.98696 8.57845 2.98696C8.18712 2.98696 7.86694 3.30714 7.86694 3.69847V4.33171C7.68907 4.38152 7.5183 4.45267 7.35466 4.54517L6.90641 4.09692C6.62892 3.81943 6.18067 3.81943 5.90318 4.09692C5.62569 4.3744 5.62569 4.82266 5.90318 5.10014L6.35143 5.54839C6.26605 5.71204 6.1949 5.8828 6.13798 6.06068H5.50473C5.1134 6.06068 4.79323 6.38086 4.79323 6.77219C4.79323 7.16352 5.1134 7.4837 5.50473 7.4837H6.13798C6.18778 7.66158 6.25893 7.83234 6.35143 7.99599L5.90318 8.44424C5.62569 8.72172 5.62569 9.16997 5.90318 9.44746C6.04548 9.58976 6.22336 9.6538 6.40835 9.6538C6.59334 9.6538 6.77122 9.58265 6.91352 9.44746L7.36177 8.99921C7.52542 9.08459 7.69618 9.15574 7.87406 9.21267V9.84591C7.87406 10.2372 8.19424 10.5574 8.58557 10.5574C8.9769 10.5574 9.29708 10.2372 9.29708 9.84591V9.21267C9.47496 9.16286 9.64572 9.09171 9.80936 8.99921L10.2576 9.44746C10.3999 9.58976 10.5778 9.6538 10.7628 9.6538C10.9478 9.6538 11.1257 9.58265 11.268 9.44746C11.5454 9.16997 11.5454 8.72172 11.268 8.44424L10.8197 7.99599H10.8055ZM7.44004 6.77219C7.44004 6.14606 7.94521 5.64089 8.57134 5.64089C9.19747 5.64089 9.70264 6.14606 9.70264 6.77219C9.70264 7.39832 9.19747 7.90349 8.57134 7.90349C7.94521 7.90349 7.44004 7.39832 7.44004 6.77219Z"
      //             fill="currentColor"
      //           ></path>
      //         </g>
      //       </g>
      //     </svg>
      //   ),
      // },
      {
        id: 'condition',
        name: '条件分支',
        kind: 'condition',
        icon: <IconCondition />,
      },
      {
        id: 'iteration',
        name: '迭代',
        kind: 'iteration',
        icon: <IconIteration />,
      },
      {
        id: 'loop',
        name: '循环',
        kind: 'loop',
        icon: <IconLoop />,
      },
    ],
  },
  {
    id: 'tools',
    name: '工具',
    nodes: [], // 可按需添加工具类节点
  },
];

// 节点菜单组件
type NodeMenuProps = {
  isOpen: boolean;
  onClose: () => void;
  onAppendNode: (node: NodeItem) => void;
  menuRef: RefObject<HTMLDivElement>;
  preferredSide?: 'left' | 'right';
  scope?: 'root' | 'iteration' | 'loop';
};

const getScopedNodes = (scope: 'root' | 'iteration' | 'loop') => {
  if (scope === 'root') {
    return NODE_CATEGORIES;
  }

  const internalNodes = NODE_CATEGORIES.map(category => ({
    ...category,
    nodes: category.nodes
      .filter(node => node.kind !== 'trigger' && node.kind !== 'end')
      .concat({
        id: scope === 'iteration' ? 'iteration-end' : 'loop-end',
        name: scope === 'iteration' ? '迭代结束' : '循环结束',
        kind: scope === 'iteration' ? 'iteration-end' : 'loop-end',
        icon: <IconOutput />,
      }),
  }));

  return internalNodes;
};

export const SearchBox = ({
  isOpen,
  onClose,
  onAppendNode,
  menuRef,
  preferredSide = 'right',
  scope = 'root',
}: NodeMenuProps) => {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [actualSide, setActualSide] = useState<'left' | 'right'>(preferredSide);

  const scopedCategories = useMemo(() => getScopedNodes(scope), [scope]);

  // 过滤节点：按搜索词 + 当前Tab
  const filteredNodes = useMemo(() => {
    const currentCategory = scopedCategories.find((cat) => cat.id === activeTab);
    if (!currentCategory) return [];

    if (!searchText.trim()) return currentCategory.nodes;

    const lowerSearch = searchText.toLowerCase();
    return currentCategory.nodes.filter((node) => node.name.toLowerCase().includes(lowerSearch));
  }, [activeTab, scopedCategories, searchText]);

  // 点击节点后关闭菜单
  const handleNodeClick = useCallback(
    (node: NodeItem) => {
      onAppendNode(node);
      onClose();
      setSearchText(''); // 清空搜索
    },
    [onAppendNode, onClose],
  );

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
        setSearchText('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, menuRef, onClose]);

  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    setActualSide(preferredSide);

    const updateSide = () => {
      if (!menuRef.current) return;

      const rect = menuRef.current.getBoundingClientRect();
      const boundaryElement = menuRef.current.closest('.react-flow') as HTMLElement | null;
      const boundaryRect = boundaryElement?.getBoundingClientRect() ?? {
        left: 0,
        right: window.innerWidth,
      };

      if (preferredSide === 'right') {
        const overflowsRight = rect.right > boundaryRect.right - 8;
        if (overflowsRight) {
          setActualSide('left');
          return;
        }
      }

      if (preferredSide === 'left') {
        const overflowsLeft = rect.left < boundaryRect.left + 8;
        if (overflowsLeft) {
          setActualSide('right');
          return;
        }
      }

      setActualSide(preferredSide);
    };

    const frameId = requestAnimationFrame(updateSide);
    window.addEventListener('resize', updateSide);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updateSide);
    };
  }, [isOpen, menuRef, preferredSide]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className={`nowheel nodrag absolute top-1/2 z-50 w-[168px] -translate-y-1/2 overflow-hidden rounded-[18px] border border-slate-200/90 bg-white/95 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.35)] ring-1 ring-slate-950/5 backdrop-blur ${actualSide === 'right' ? 'left-8' : 'right-8'}`}
      onClick={(e) => e.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      {/* Tab 切换栏 */}
      <div className="flex border-b border-slate-100 bg-white/90 px-1 pt-1">
        {scopedCategories.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-t-xl py-2 text-center text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-600 bg-blue-50/80 text-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* 搜索框 */}
      <div className="border-b border-slate-100 px-2.5 py-2">
        <div className="relative">
          {/* search svg */}
          <input
            type="text"
            placeholder="搜索节点"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* 节点列表（带分类分组，可按需开启） */}
      <div className="nowheel max-h-[240px] overflow-y-auto px-1.5 pb-1.5 pt-1.5">
        {filteredNodes.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">暂无匹配节点</div>
        ) : (
          <div className="space-y-1">
            {filteredNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => handleNodeClick(node)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-slate-100"
              >
                {/* 图标容器（带背景色，匹配截图） */}
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    node.id === 'llm' || node.id === 'agent'
                      ? 'bg-indigo-100'
                      : node.id === 'knowledge' || node.id === 'classifier'
                        ? 'bg-green-100'
                        : node.id === 'output'
                          ? 'bg-amber-100'
                          : 'bg-sky-100'
                  }`}
                >
                  {node.icon}
                </div>
                {/* 节点名称 */}
                <span className="truncate text-xs font-medium text-slate-800">{node.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
