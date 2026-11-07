import { Link } from "react-router-dom";
import { Layers } from "lucide-react";

import { cn } from "../../utils/cn.js";

/**
 * WorkFlow logo — gradient mark + wordmark.
 * `tone="dark"` (default) is for navy surfaces; `tone="light"` for white ones.
 */
export default function Logo({ to = "/", className, compact = false, tone = "dark" }) {
  return (
    <Link to={to} className={cn("group flex items-center gap-2.5", className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-glow transition-transform duration-200 group-hover:scale-105">
        <Layers className="h-5 w-5 text-white" strokeWidth={2.2} />
      </span>

      {!compact && (
        <span className="text-lg font-bold tracking-tight">
          <span className={tone === "dark" ? "text-white" : "text-slate-900"}>
            Work
          </span>
          <span className={tone === "dark" ? "text-brand-400" : "text-brand-600"}>
            Flow
          </span>
        </span>
      )}
    </Link>
  );
}
