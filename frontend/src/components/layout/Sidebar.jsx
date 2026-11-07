import { NavLink } from "react-router-dom";
import {
  CalendarDays,
  FolderKanban,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  Settings,
  Users,
  X,
} from "lucide-react";

import Logo from "../ui/Logo.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { cn } from "../../utils/cn.js";

const NAV_SECTIONS = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, to: "/" },
      { label: "My Tasks", icon: ListChecks, to: "/tasks" },
      { label: "Board", icon: KanbanSquare, to: "/board" },
      { label: "Projects", icon: FolderKanban, to: "/projects" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Calendar", icon: CalendarDays, soon: true },
      { label: "Team", icon: Users, soon: true },
    ],
  },
];

const linkClass = ({ isActive }) =>
  cn(
    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
    isActive
      ? "bg-white/10 text-white shadow-inner"
      : "text-slate-400 hover:bg-white/5 hover:text-white"
  );

const initialsOf = (name) =>
  (name || "User")
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * Dark navy navigation sidebar.
 * Static rail on lg+, slide-over drawer on smaller screens.
 */
export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const roleLabel =
    user?.role === "admin" ? "Workspace Admin" : "Workspace Member";

  return (
    <>
      {/* Backdrop (mobile only) */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-navy-950/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gradient-to-b from-navy-900 via-navy-900 to-navy-950 transition-transform duration-300 lg:z-30 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-5">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {section.label}
              </p>

              <ul className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;

                  if (item.soon) {
                    return (
                      <li key={item.label}>
                        <button
                          type="button"
                          disabled
                          title="Coming soon"
                          className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 opacity-70"
                        >
                          <Icon className="h-[18px] w-[18px]" />
                          <span className="flex-1 text-left">{item.label}</span>
                          <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-300">
                            Soon
                          </span>
                        </button>
                      </li>
                    );
                  }

                  return (
                    <li key={item.label}>
                      <NavLink to={item.to} end={item.to === "/"} className={linkClass}>
                        {({ isActive }) => (
                          <>
                            <span
                              className={cn(
                                "absolute left-0 h-5 w-1 rounded-r-full bg-gradient-to-b from-brand-400 to-accent-400 transition-opacity",
                                isActive ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <Icon className="h-[18px] w-[18px]" />
                            <span className="flex-1">{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer: settings + user card */}
        <div className="space-y-3 border-t border-white/5 p-3">
          <button
            type="button"
            disabled
            title="Coming soon"
            className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 opacity-70"
          >
            <Settings className="h-[18px] w-[18px]" />
            <span className="flex-1 text-left">Settings</span>
            <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-300">
              Soon
            </span>
          </button>

          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-bold text-white">
              {initialsOf(user?.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {user?.name}
              </p>
              <p className="truncate text-xs text-slate-400">{roleLabel}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
