/**
 * Dependency-free SVG donut chart.
 * segments: [{ label, value, color }] — hex colors for SVG strokes.
 */
export default function ChartDonut({
  segments,
  size = 168,
  thickness = 15,
  centerValue,
  centerLabel,
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const visible = segments.filter((segment) => segment.value > 0);

  let cursor = 0;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          {/* Track */}
          <circle
            cx="50"
            cy="50"
            r="41"
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={thickness}
          />
          {total > 0
            ? visible.map((segment) => {
                const pct = (segment.value / total) * 100;
                const dash = Math.min(pct, 100);
                const el = (
                  <circle
                    key={segment.label}
                    cx="50"
                    cy="50"
                    r="41"
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={thickness}
                    strokeLinecap={dash < 100 ? "round" : "butt"}
                    pathLength={100}
                    strokeDasharray={`${dash} ${100 - dash}`}
                    strokeDashoffset={-cursor}
                  >
                    <title>{`${segment.label}: ${segment.value}`}</title>
                  </circle>
                );
                cursor += pct;
                return el;
              })
            : null}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-slate-900">
            {centerValue ?? (total || 0)}
          </span>
          {centerLabel ? (
            <span className="mt-0.5 text-[11px] font-medium text-slate-500">
              {centerLabel}
            </span>
          ) : null}
        </div>
      </div>

      {/* Legend */}
      <ul className="w-full space-y-2">
        {segments.map((segment) => (
          <li
            key={segment.label}
            className="flex items-center justify-between text-sm"
          >
            <span className="flex items-center gap-2 text-slate-600">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              {segment.label}
            </span>
            <span className="font-bold tabular-nums text-slate-800">
              {segment.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
