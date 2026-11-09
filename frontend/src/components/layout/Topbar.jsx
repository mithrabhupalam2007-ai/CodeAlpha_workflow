import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { HelpCircle, Menu, Search } from "lucide-react";

import ApiStatus from "../ui/ApiStatus.jsx";
import NotificationsMenu from "./NotificationsMenu.jsx";
import UserMenu from "./UserMenu.jsx";

const TITLES = {
  "/": { title: "Dashboard", subtitle: "Your workspace at a glance" },
  "/projects": { title: "Projects", subtitle: "Manage every project in one place" },
  "/tasks": { title: "My Tasks", subtitle: "Search, filter and update every task" },
  "/board": { title: "Board", subtitle: "Drag & drop your work across stages" },
  "/settings": { title: "Settings", subtitle: "Workspace preferences" },
};

/**
 * Sticky topbar: page title, search, live API status,
 * notifications dropdown (real activity), and the user menu.
 */
export default function Topbar({ onMenuClick }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const handleSearch = (e) => {
    e.preventDefault();
    const query = e.target.elements.search.value.trim();
    if (query) {
      navigate(`/tasks?q=${encodeURIComponent(query)}`);
    } else {
      navigate("/tasks");
    }
  };

  const isProjectDetail = pathname.startsWith("/projects/");
  const { title, subtitle } = isProjectDetail
    ? { title: "Project", subtitle: "Overview, members & invitations" }
    : (TITLES[pathname] ?? {
        title: "WorkFlow",
        subtitle: "",
      });

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open sidebar"
          className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Page title */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
            {title}
          </h1>
          {subtitle ? (
            <p className="hidden truncate text-xs text-slate-500 sm:block">
              {subtitle}
            </p>
          ) : null}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            name="search"
            defaultValue={searchParams.get("q") || ""}
            placeholder="Search tasks…"
            aria-label="Search tasks"
            className="w-64 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 transition-all focus:w-72 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10 lg:w-72 lg:focus:w-80"
          />
        </form>

        {/* Live API status */}
        <ApiStatus />

        {/* Notifications (real activity feed) */}
        <NotificationsMenu />

        <button
          type="button"
          aria-label="Help"
          className="hidden rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 sm:block"
        >
          <HelpCircle className="h-5 w-5" />
        </button>

        {/* Account */}
        <UserMenu />
      </div>
    </header>
  );
}
