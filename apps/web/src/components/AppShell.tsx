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
    <main className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_88%_8%,rgba(186,230,253,0.65),transparent_34%),radial-gradient(circle_at_14%_92%,rgba(254,243,199,0.7),transparent_38%),#f8fbfb] text-ink">
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
              <p className="text-[20px] font-semibold tracking-[0.08em] flex items-center">
                <svg className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6811" width="36" height="36"><path d="M546.79 1022.701v-10.445c-43.374-8.009-78.395-39.984-99.412-57.101 221.553 26.692 268.422-63.225 278.364-78.68 9.946-15.454 9.946-59.01 9.946-59.01l9.936 49.175s28.407-8.427 69.594-78.674c39.77-70.247 17.04-141.9 9.94-186.858-44.022-125.037-9.94-171.4 9.947-226.193 17.04-95.532-19.887-147.519-19.887-147.519 45.448 23.885 39.77 127.849 39.77 127.849s8.52 7.023 19.882 0c11.362-7.023 12.78-26.693 19.883-39.34 7.1 21.078-17.045 64.629-29.828 88.514 19.887-14.05 49.711 23.881 49.711 49.175 0 25.285-19.883 49.17-9.937 68.84 9.937 19.67 9.937 59.004 9.937 59.004s-2.842-21.074-19.883-39.336c-17.045-18.266-8.52-63.224-9.94-88.509-5.684-23.885-39.765 19.666-39.765 19.666-29.828 26.693 9.94 98.344 9.94 98.344 51.128 82.89 39.765 137.684 39.765 137.684l-2.773 8.239C1017.342 524.13 956.458 349.092 934.52 286.4c16.158 40.57 9.946 127.85 9.946 127.85C930.79 188.055 666.097 40.541 666.097 40.541l-3.66-7.245c209.342 63.572 361.554 256.292 361.554 484.216 0 268.14-210.678 487.473-477.2 505.188z m178.95-903.483c125.93 213.081-69.593 344.207-69.593 344.207-36.45 8.197-59.647-19.666-59.647-19.666h-9.937l-9.946-9.835v-9.835c129.24-36.062 119.295-177.023 119.295-177.023-6.622 88.51-89.471 149.157-99.412 157.353-18.227 1.638 0-29.504 0-29.504 62.966-60.648 64.622-99.983 59.647-177.024-4.966-77.036-112.669-152.433-218.716-118.014-106.047 34.424-101.072 119.657-99.417 137.684 1.66 18.03-19.878 0-19.878 0C291.62 48.736 427.49 11.04 427.49 11.04c183.923-54.09 298.25 108.179 298.25 108.179zM477.198 276.572c67.937-6.558 111.022 67.201 99.42 127.848 0 0-23.197-91.79-129.24-98.344-106.047-6.558-125.93-91.79-79.534-118.018 0 0 18.227-14.75 49.71-9.835 0 0 14.912 18.031 0 19.67-14.916 1.643-72.908 13.112-39.773 49.175 0-0.001 31.487 36.062 99.417 29.504z m59.651 314.7c-9.94-40.977-59.651-88.508-59.651-88.508s48.05 14.75 69.593 49.174c21.542 34.42 13.257 44.25 89.48 78.674 76.22 34.42 39.765 78.675 39.765 78.675 3.311-29.501-8.286-50.809-39.765-59.005-31.484-8.196-89.48-18.03-99.422-59.01z m-79.529-265.53c76.22 4.92 92.786 50.812 99.417 68.844-6.63 40.977 11.597 67.205 49.707 78.674 46.395 8.197 69.593 39.34 69.593 39.34h39.765v9.834l9.94 9.835s-4.965 34.42 0 49.17c4.972 14.75-19.882 9.835-19.882 9.835v-29.5h-79.53v19.665h-9.946v9.835h-9.941v-29.5c1.655-19.67-46.396-47.537-79.535-78.68-33.134-31.143-101.072-21.304-129.24-19.67-28.164 1.638-3.311 37.7 39.764 59.01 43.085 21.307 72.909 57.37 79.538 78.674 6.622 21.313 8.277 55.728 49.707 78.679 41.42 22.947 69.593 0 69.593 0h19.878v9.83h-9.94c-61.308 63.93-134.212 16.395-149.123-39.334-14.912-55.728-48.05-88.509-89.476-88.509s-87.816-6.558-99.412-39.34c-11.6-32.781-21.542-45.897-39.773-68.839-57.988-37.7-59.648 9.83-59.648 9.83h-9.937c-41.428-55.728 29.82-59.004 29.82-59.004 0-18.03-49.707-9.834-49.707-9.834 48.051-75.398 109.358-29.505 109.358-29.505-99.417-239.305 59.652-314.703 59.652-314.703C212.09 238.869 381.1 320.826 457.319 325.74z m39.09 67.136c11.299 7.71 22.984 10.337 26.108 5.866 3.115-4.466-3.516-14.344-14.813-22.058s-22.985-10.338-26.1-5.871c-3.118 4.472 3.512 14.35 14.806 22.063zM39.77 537.183c0 135.858 54.127 259.15 142.16 350.083 10.291 3.268 44.621 13.752 46.729 8.88-4.966-25.405-22.37-107.36 9.946-118.015-1.536 13.649-8.427 141.537 132.253 210.585-42.688-33.681-108.987-101.83-122.312-210.585 0 0 1.655-98.344 0-118.014s-18.231-62.286-39.77-59.01c0 0-13.257-6.553-9.937 19.67 3.311 26.228 1.655 59.01 0 78.675-1.664 19.67-13.257 45.897-39.773 39.34 0 0 38.11-21.308 19.886-59.005-18.222-37.7 0-68.844 0-68.844s-31.483-29.505-39.764-49.17c-8.286-19.67-8.286-34.42-29.828-39.34 14.912-6.558 36.454-4.92 49.707 39.34 8.286 18.03 19.886 19.666 19.886 19.666s9.941-63.925-19.886-88.51c-29.82-24.584-29.82-39.335-29.82-39.335s61.302 11.469 69.593 98.344c0 0 9.937 21.304 29.82 29.5 19.887 8.198 46.396 26.229 49.71 59.01 24.853-39.34 59.648-68.844 69.594-68.844 0 0 94.446 6.558 119.299 49.175-34.795 19.67-149.123 95.067-119.3 226.193 9.942 45.893 49.708 137.683 198.83 177.019H417.556s-137.132-23.845-238.603-118.01C16.238 750.865 0 606.428 0 517.513 0 309.041 127.367 130.051 309.292 52.367c-14.17 17.053-33.92 42.381-50.678 69.684C126.343 213.624 39.77 365.363 39.77 537.183z" p-id="6812"></path></svg>
                
                <span className="ml-2">Kronos</span>
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
      <div className="mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 flex-col overflow-hidden p-3">
        <Outlet />
      </div>
    </main>
  );
};