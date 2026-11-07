import { cn } from "../../utils/cn.js";

/** Standard dashboard panel: rounded card with an optional header. */
export default function Card({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-panel border border-slate-200/70 bg-surface p-6 shadow-soft",
        className
      )}
    >
      {title || action ? (
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <h3 className="truncate text-base font-bold text-slate-900">
                {title}
              </h3>
            ) : null}
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {subtitle}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}

      <div className={cn("min-w-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
