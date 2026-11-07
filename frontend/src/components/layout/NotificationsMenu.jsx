import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";

import ActivityItem from "../dashboard/ActivityItem.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import { getActivity } from "../../api/dashboard.js";
import { useClickOutside } from "../../hooks/useClickOutside.js";
import { useSocket } from "../../context/SocketContext.jsx";
import { isSameLocalDay } from "../../utils/dates.js";
import { cn } from "../../utils/cn.js";

/**
 * Bell dropdown fed by GET /api/dashboard/activity and live Socket.IO events.
 * Badge = number of unseen entries that happened today.
 */
export default function NotificationsMenu() {
  const { socket } = useSocket();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState(null); // null = not loaded yet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [seenAt, setSeenAt] = useState(null);
  const [hasNewAlert, setHasNewAlert] = useState(false);
  const rootRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close, open);

  // Load feed on mount and on reloadKey changes so badge is accurate right away
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getActivity(8)
      .then((data) => {
        if (!cancelled) setEntries(data.activity);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Real-time notifications from Socket.IO user room
  useEffect(() => {
    if (!socket) return;

    const onNewNotification = (notification) => {
      setEntries((prev) => {
        const current = prev || [];
        if (current.some((e) => e.id === notification.id)) return current;
        return [notification, ...current];
      });
      setHasNewAlert(true);
    };

    socket.on("notification:new", onNewNotification);

    return () => {
      socket.off("notification:new", onNewNotification);
    };
  }, [socket]);

  const handleOpenToggle = () => {
    setOpen((value) => {
      if (!value) setHasNewAlert(false);
      return !value;
    });
  };

  const handleMarkSeen = () => {
    setSeenAt(new Date().toISOString());
    close();
  };

  const todayCount = (entries || []).filter(
    (entry) =>
      isSameLocalDay(entry.createdAt) &&
      (!seenAt || new Date(entry.createdAt) > new Date(seenAt))
  ).length;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={handleOpenToggle}
        aria-label={
          todayCount > 0
            ? `Notifications, ${todayCount} new today`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="menu"
        className="relative rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      >
        <Bell className={cn("h-5 w-5 transition-colors", hasNewAlert && "text-brand-600 animate-pulse")} />
        {todayCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white animate-fade-in">
            {todayCount > 9 ? "9+" : todayCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"
        >
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h4 className="text-sm font-bold text-slate-900">Notifications</h4>
            {entries && entries.length > 0 ? (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-600">
                {todayCount} new today
              </span>
            ) : null}
          </header>

          <div className="max-h-96 overflow-y-auto px-3 py-2">
            {/* Loading */}
            {loading && !entries ? (
              <div className="space-y-3 px-1 py-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Error */}
            {error && !loading ? (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                <p className="text-sm font-medium text-slate-600">
                  Couldn’t load notifications
                </p>
                <button
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              </div>
            ) : null}

            {/* Empty */}
            {entries && entries.length === 0 && !loading ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                  <Bell className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold text-slate-700">
                  You’re all caught up
                </p>
                <p className="text-xs text-slate-400">
                  Activity from your workspace shows up here.
                </p>
              </div>
            ) : null}

            {/* List */}
            {entries && entries.length > 0 && !loading ? (
              <ul className="divide-y divide-slate-100">
                {entries.map((entry) => (
                  <ActivityItem key={entry.id} entry={entry} />
                ))}
              </ul>
            ) : null}
          </div>

          <footer className="border-t border-slate-100 px-4 py-2.5">
            <button
              type="button"
              onClick={handleMarkSeen}
              className="inline-flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark as seen
            </button>
          </footer>
        </div>
      ) : null}
    </div>
  );
}
