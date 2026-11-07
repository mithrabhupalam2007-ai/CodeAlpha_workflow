import { CalendarClock } from "lucide-react";

import Card from "../ui/Card.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import { DUE_TONES, TASK_STATUS, projectColor } from "../../utils/projectColors.js";
import { dueLabel, formatDate } from "../../utils/dates.js";
import { cn } from "../../utils/cn.js";

/** Tasks across the workspace with the nearest upcoming due dates. */
export default function UpcomingDeadlinesCard({ tasks }) {
  return (
    <Card title="Upcoming Deadlines" subtitle="Next due across your projects">
      {!tasks || tasks.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No deadlines coming up"
          description="Tasks with future due dates will be listed here."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {tasks.map((task) => {
            const due = dueLabel(task.dueDate);
            const color = projectColor(task.project?.color);
            const status = TASK_STATUS[task.status] || TASK_STATUS.todo;

            return (
              <li
                key={task.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg border border-slate-200 bg-white leading-none shadow-soft">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    {new Date(task.dueDate)
                      .toLocaleDateString(undefined, { month: "short" })
                      .toUpperCase()}
                  </span>
                  <span className="mt-0.5 text-sm font-bold tabular-nums text-slate-800">
                    {new Date(task.dueDate).getDate()}
                  </span>
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {task.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                    <span
                      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", color.dot)}
                    />
                    <span className="truncate">
                      {task.project?.name || "No project"}
                      {task.assignee ? ` · ${task.assignee.name}` : ""}
                    </span>
                  </p>
                </div>

                <span
                  className={cn(
                    "hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:block",
                    status.className
                  )}
                >
                  {status.label}
                </span>

                {due ? (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      DUE_TONES[due.tone] ?? DUE_TONES.slate
                    )}
                    title={formatDate(task.dueDate, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  >
                    {due.text}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
