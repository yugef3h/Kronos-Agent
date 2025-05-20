import { NavLink, Outlet } from 'react-router-dom';
import { DropdownMenu } from './DropdownMenu';
import { workflowMenuItems } from './workflowNavMenuConfig';

type NavIcon = 'home' | 'workflow' | 'memory';

type NavItem = {
  to: string;
  label: string;
  icon: NavIcon;
  end?: boolean;
};

// 导航配置（不变）
const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: '首页', icon: 'home', end: true },
  { to: '/workflow', label: '工作流', icon: 'workflow' },
  { to: '/memory', label: '记忆', icon: 'memory' },
];

const renderNavIcon = (icon: NavIcon) => {
  const iconClassName = 'h-4 w-4';

  if (icon === 'home') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 9.5V21h13V9.5" />
      </svg>
    );
  }

  if (icon === 'workflow') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
        <circle cx="6" cy="6" r="2.2" />
        <circle cx="18" cy="12" r="2.2" />
        <circle cx="6" cy="18" r="2.2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.2 7.1 15.8 10.9M8.2 16.9l7.6-3.8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClassName}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 5.5h12v13H6z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.5h6M9 13h6M9 16.5h4" />
    </svg>
  );
};

export const AppShell = () => {
  return (
    <main className="relative min-h-screen bg-[radial-gradient(circle_at_88%_8%,rgba(186,230,253,0.65),transparent_34%),radial-gradient(circle_at_14%_92%,rgba(254,243,199,0.7),transparent_38%),#f8fbfb] text-ink">
      {/* 顶部渐变遮罩（优化层级） */}
      <div 
        aria-hidden 
        className="pointer-events-none absolute inset-x-0 top-0 z-40 h-32 bg-gradient-to-b from-white/70 to-transparent" 
      />

      {/* 头部导航栏 - 核心优化区域 */}
      <header className="sticky top-0 z-50">
        {/* 导航容器：背景、模糊、边框、内边距统一优化 */}
        <div className="mx-auto max-w-[1680px] px-3 md:px-4">
          <div className="flex flex-col gap-3 py-2 lg:flex-row lg:items-center lg:justify-between">
            {/* 品牌标识 */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700">
                Kronos Workspace
              </p>
            </div>

            {/* 导航菜单 */}
            <nav className="flex flex-wrap gap-2">
              {NAV_ITEMS.map((item) => {
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-300 ${
                        isActive
                          ? 'border-cyan-500 bg-cyan-600 text-white shadow-md'
                          : 'border-slate-200 bg-white/90 text-slate-700 hover:border-cyan-300 hover:bg-cyan-50 hover:shadow-sm'
                      }`
                    }
                  >
                    {renderNavIcon(item.icon)}
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>

        {/* 底部边框：独立层级，全屏宽度，清晰分隔 */}
        <div className="h-px w-full bg-slate-200" />
      </header>

      {/* 内容区域（优化内边距） */}
      <div className="mx-auto max-w-[1680px] p-3">
        <Outlet />
      </div>
    </main>
  );
};