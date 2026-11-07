/**
 * Dependency-free weekly bar chart (Tailwind heights).
 * data: [{ date: "YYYY-MM-DD", count }] — always 7 entries.
 */
export default function WeeklyBarChart({ data = [], height = 168 }) {
  const max = Math.max(...data.map((day) => day.count), 1);
  const hasAny = data.some((day) => day.count > 0);

  return (
    <div>
      <div className="flex items-stretch gap-2" style={{ height }}>
        {data.map((day) => {
          const pct = Math.round((day.count / max) * 100);
          const label = new Date(`${day.date}T00:00:00`).toLocaleDateString(
            undefined,
            { weekday: "short" }
          );
          const isoLabel = new Date(`${day.date}T00:00:00`).toLocaleDateString(
            undefined,
            { weekday: "long", month: "short", day: "numeric" }
          );

          return (
            <div
              key={day.date}
              className="group flex flex-1 flex-col items-center gap-1.5"
              title={`${day.count} completed on ${isoLabel}`}
            >
              <span className="text-[10px] font-bold tabular-nums text-slate-500">
                {day.count}
              </span>

              <div className="flex w-full flex-1 items-end">
                <div
                  className={
                    "w-full rounded-t-md transition-all duration-500 " +
                    (day.count > 0
                      ? "bg-gradient-to-t from-brand-500 to-accent-400 group-hover:from-brand-600 group-hover:to-accent-500"
                      : "bg-slate-100")
                  }
                  style={{ height: `${Math.max(pct, 6)}%` }}
                />
              </div>

              <span className="text-[10px] font-medium text-slate-400">
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {!hasAny ? (
        <p className="mt-3 text-center text-xs text-slate-400">
          No tasks completed yet this week
        </p>
      ) : null}
    </div>
  );
}
