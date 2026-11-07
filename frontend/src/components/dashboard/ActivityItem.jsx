import {
  CheckCircle2,
  FolderKanban,
  ListChecks,
  MessageSquare,
  Pencil,
  UserPlus,
  Users,
} from "lucide-react";

import { relativeTime } from "../../utils/dates.js";
import { cn } from "../../utils/cn.js";

const TYPE_STYLES = {
  "project.created": { Icon: FolderKanban, box: "bg-brand-50 text-brand-600" },
  "project.updated": { Icon: Pencil, box: "bg-sky-50 text-sky-600" },
  "task.created": { Icon: ListChecks, box: "bg-accent-50 text-accent-600" },
  "task.assigned": { Icon: UserPlus, box: "bg-amber-50 text-amber-600" },
  "task.completed": { Icon: CheckCircle2, box: "bg-emerald-50 text-emerald-600" },
  "comment.added": { Icon: MessageSquare, box: "bg-rose-50 text-rose-600" },
  "member.joined": { Icon: Users, box: "bg-sky-50 text-sky-600" },
  "member.removed": { Icon: Users, box: "bg-rose-50 text-rose-600" },
  "invitation-accepted": { Icon: Users, box: "bg-sky-50 text-sky-600" },
};

/** Single activity-feed row — shared by the dashboard card and the bell menu. */
export default function ActivityItem({ entry, className }) {
  const { Icon, box } = TYPE_STYLES[entry.type] || TYPE_STYLES["task.created"];

  return (
    <li className={cn("flex items-start gap-3 px-1 py-2.5", className)}>
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          box
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0">
        <p className="text-sm leading-snug text-slate-700">
          <span className="font-semibold text-slate-900">
            {entry.actor?.name || "Someone"}
          </span>{" "}
          {entry.message}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          {relativeTime(entry.createdAt)}
        </p>
      </div>
    </li>
  );
}
