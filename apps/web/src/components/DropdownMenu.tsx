import type { ReactNode } from 'react';
import { matchPath, NavLink, useLocation } from 'react-router-dom';

export type DropdownMenuItem = {
  to: string;
  label: string;
  description: string;
  icon: ReactNode;
  end?: boolean;
};

type NavDropdownMenuProps = {
  triggerTo: string;
  triggerLabel: string;
  triggerEnd?: boolean;
  items: readonly DropdownMenuItem[];
};

const getTriggerClassName = (isActive: boolean, hasActiveChild: boolean) => {
  return `flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-300 ${
    isActive
      ? 'border-cyan-500 bg-cyan-600 text-white shadow-md'
      : hasActiveChild
        ? 'border-cyan-500 bg-white/90 text-slate-700 shadow-sm hover:bg-cyan-50'
        : 'border-slate-200 bg-white/90 text-slate-700 hover:border-cyan-300 hover:bg-cyan-50 hover:shadow-sm'
  }`;
};

export const DropdownMenu = ({ triggerTo, triggerLabel, triggerEnd = false, items }: NavDropdownMenuProps) => {
  const location = useLocation();
  const hasActiveChild = items.some((item) => {
    return Boolean(
      matchPath(
        {
          path: item.to,
          end: item.end ?? false,
        },
        location.pathname,
      ),
    );
  });

  return (
    <div className="group/nav-dropdown relative">
      <NavLink
        to={triggerTo}
        end={triggerEnd}
        className={({ isActive }) => getTriggerClassName(isActive, hasActiveChild && !isActive)}
      >
        <span>{triggerLabel}</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
          className="h-4 w-4 transition-transform duration-200 group-hover/nav-dropdown:rotate-180 group-focus-within/nav-dropdown:rotate-180"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 7.5 5 5 5-5" />
        </svg>
      </NavLink>

      <div className="pointer-events-none invisible absolute left-1/2 top-full z-50 w-[min(18rem,calc(100vw-1.5rem))] -translate-x-1/2 pt-2 opacity-0 transition-all duration-200 group-hover/nav-dropdown:pointer-events-auto group-hover/nav-dropdown:visible group-hover/nav-dropdown:opacity-100 group-focus-within/nav-dropdown:pointer-events-auto group-focus-within/nav-dropdown:visible group-focus-within/nav-dropdown:opacity-100 md:left-auto md:right-0 md:translate-x-0">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-[0_24px_48px_-24px_rgba(14,116,144,0.45)] backdrop-blur">
          {items.map(({ to, label, description, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className="flex items-start gap-3 rounded-xl px-3 py-3 text-slate-700 transition-colors hover:bg-slate-50"
            >
              <>
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  {icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
                </span>
              </>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
};