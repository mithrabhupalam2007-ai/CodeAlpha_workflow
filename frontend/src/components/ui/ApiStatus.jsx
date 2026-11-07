import { useSocket } from "../../context/SocketContext.jsx";
import useHealth from "../../hooks/useHealth.js";
import { cn } from "../../utils/cn.js";

/**
 * Live connection badge: shows API + realtime status in the topbar.
 * API status is verified against GET /api/health.
 */
export default function ApiStatus({ className }) {
  const { online, loading } = useHealth();
  const { isConnected: socketConnected } = useSocket();

  const status = loading
    ? { label: "Connecting…", dot: "bg-amber-400", text: "text-amber-600" }
    : online
      ? { label: "Live", dot: "bg-emerald-500", text: "text-emerald-600" }
      : { label: "Offline", dot: "bg-rose-500", text: "text-rose-600" };

  return (
    <div
      title={`API ${status.label.toLowerCase()} · realtime ${
        socketConnected ? "connected" : "disconnected"
      }`}
      className={cn(
        "hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-soft sm:flex",
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        {online && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={cn("relative inline-flex h-2 w-2 rounded-full", status.dot)}
        />
      </span>
      <span className={cn("text-xs font-semibold", status.text)}>
        {status.label}
      </span>
      <span
        className={cn(
          "h-3 w-px bg-slate-200",
          socketConnected && "bg-emerald-200"
        )}
      />
      <span className="text-xs font-medium text-slate-400">Realtime</span>
    </div>
  );
}
