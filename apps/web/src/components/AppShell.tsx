import { NavLink, Outlet, useLocation } from 'react-router-dom';

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
  { to: '/rag', label: '知识库', icon: 'memory' },
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

const getActiveNavIndex = (pathname: string) => {
  const activeIndex = NAV_ITEMS.findIndex((item) => {
    if (item.end) {
      return pathname === item.to;
    }

    return pathname.startsWith(item.to);
  });

  return activeIndex >= 0 ? activeIndex : 0;
};

export const AppShell = () => {
  const { pathname } = useLocation();
  const activeNavIndex = getActiveNavIndex(pathname);

  return (
    <main className="relative flex min-h-screen flex-col bg-[radial-gradient(circle_at_88%_8%,rgba(186,230,253,0.65),transparent_34%),radial-gradient(circle_at_14%_92%,rgba(254,243,199,0.7),transparent_38%),#f8fbfb] text-ink">
      {/* 顶部渐变遮罩（优化层级） */}
      <div 
        aria-hidden 
        className="pointer-events-none absolute inset-x-0 top-0 z-40 h-32 bg-gradient-to-b from-white/70 to-transparent" 
      />

      {/* 头部导航栏 - 核心优化区域 */}
      <header className="sticky top-0 z-50 shrink-0">
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
            <nav
              aria-label="主导航"
              className="relative inline-grid min-h-11 grid-cols-3 rounded-full border border-slate-200/80 bg-white/85 p-1 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-1 left-1 rounded-full bg-cyan-600 shadow-[0_8px_24px_rgba(8,145,178,0.35)] transition-transform duration-300 ease-out"
                style={{
                  width: `calc((100% - 0.5rem) / ${NAV_ITEMS.length})`,
                  transform: `translateX(${activeNavIndex * 100}%)`,
                }}
              />
              {NAV_ITEMS.map((item) => {
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `relative z-10 inline-flex min-w-[92px] items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors duration-300 ${
                        isActive
                          ? 'text-white'
                          : 'text-slate-600 hover:text-cyan-700'
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
      <div className="mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 p-3">
        <Outlet />
      </div>
    </main>
  );
};