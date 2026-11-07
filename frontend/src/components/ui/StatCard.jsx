import { cn } from "../../utils/cn.js";

const TONES = {
  indigo: "from-brand-500 to-brand-600",
  blue: "from-accent-500 to-accent-600",
  sky: "from-sky-500 to-cyan-500",
  amber: "from-amber-500 to-orange-500",
  emerald: "from-emerald-500 to-teal-500",
  rose: "from-rose-500 to-pink-500",
};

const HINT_TONES = {
  emerald: "bg-emerald-50 text-emerald-600",
  rose: "bg-rose-50 text-rose-600",
  amber: "bg-amber-50 text-amber-600",
  indigo: "bg-brand-50 text-brand-600",
  slate: "bg-slate-100 text-slate-500",
};

/**
 * Dashboard stat card: icon, label, value, optional hint chip.
 */
export default function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "indigo",
  hintTone = "emerald",
  className,
  style,
}) {
  return (
    <div
      style={style}
      className={cn(
        "group rounded-card border border-slate-200/70 bg-surface p-5 shadow-soft",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-soft",
            TONES[tone] ?? TONES.indigo
          )}
        >
          {Icon ? <Icon className="h-5 w-5" strokeWidth={2} /> : null}
        </span>

        {hint ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              HINT_TONES[hintTone] ?? HINT_TONES.emerald
            )}
          >
            {hint}
          </span>
        ) : null}
      </div>

      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-500">{label}</p>
    </div>
  );
}
