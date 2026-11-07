import { ListChecks } from "lucide-react";

import Card from "../ui/Card.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import {
  DUE_TONES,
  TASK_PRIORITY,
  projectColor,
} from "../../utils/projectColors.js";
import { dueLabel } from "../../utils/dates.js";
import { cn } from "../../utils/cn.js";

/** The signed-in user's open tasks, nearest deadline first. */
export default function MyTasksCard({ tasks }) {
  return (
    <Card
      title="My Tasks"
      subtitle="Assigned to you · nearest deadline first"
    >
      {!tasks || tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="You’re all caught up"
          description="Tasks assigned to you will appear here."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {tasks.map((task) => {
            const due = dueLabel(task.dueDate);
            const priority =
              TASK_PRIORITY[task.priority] || TASK_PRIORITY.medium;
            const color = projectColor(task.project?.color);

            return (
              <li
                key={task.id}
                className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-200 transition-colors group-hover:border-brand-400 group-hover:bg-brand-50" />

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
                    </span>
                  </p>
                </div>

                <span
                  className={cn(
                    "hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:block",
                    priority.className
                  )}
                >
                  {priority.label}
                </span>

                {due ? (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      DUE_TONES[due.tone] ?? DUE_TONES.slate
                    )}
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
