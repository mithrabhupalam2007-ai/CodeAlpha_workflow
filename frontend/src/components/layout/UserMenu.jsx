import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";

import { useAuth } from "../../context/AuthContext.jsx";
import { useClickOutside } from "../../hooks/useClickOutside.js";
import { initialsOf } from "../../utils/dates.js";
import { cn } from "../../utils/cn.js";

/** Avatar dropdown: identity, placeholder links, log out. */
export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close, open);

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true);
    close();
    await logout();
    navigate("/login", { replace: true });
  };

  const items = [
    { label: "Profile", Icon: UserRound, soon: true },
    { label: "Settings", Icon: Settings, soon: true },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-xl p-1 pr-1.5 transition-colors hover:bg-slate-100"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-bold text-white">
          {initialsOf(user?.name)}
        </span>
        <span className="hidden text-sm font-semibold text-slate-700 xl:block">
          {user?.name}
        </span>
        <ChevronDown
          className={cn(
            "hidden h-4 w-4 text-slate-400 transition-transform xl:block",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"
        >
          {/* Identity */}
          <header className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-bold text-white">
              {initialsOf(user?.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {user?.name}
              </p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          </header>

          {/* Links */}
          <nav className="p-1.5">
            {items.map(({ label, Icon, soon }) => (
              <Link
                key={label}
                to="#"
                onClick={(event) => event.preventDefault()}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <Icon className="h-4 w-4 text-slate-400" />
                {label}
                {soon ? (
                  <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Soon
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>

          {/* Log out */}
          <div className="border-t border-slate-100 p-1.5">
            <button
              type="button"
              onClick={handleLogout}
              disabled={busy}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {busy ? "Logging out…" : "Log out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
