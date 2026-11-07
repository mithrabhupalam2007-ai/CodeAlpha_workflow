import {
  ClipboardList,
  Inbox,
  Link2,
  MessageSquare,
  Pencil,
  Trash2,
  UserRoundPlus,
} from "lucide-react";

import { getTaskActivity } from "../../api/tasks.js";
import { relativeTime } from "../../utils/dates.js";
import { TASK_STATUS } from "../../utils/projectColors.js";
import { useAuth } from "../../context/AuthContext.jsx";

const TYPE_META = {
  "task-created": { icon: ClipboardList, label: "created this task" },
  "task-updated": { icon: Pencil, label: "updated this task" },
  "task-status": { icon: ClipboardList, label: "changed status" },
  "task-assigned": { icon: UserRoundPlus, label: "assigned" },
  "task-unassigned": { icon: UserRoundPlus, label: "cleared the assignee" },
  "comment-added": { icon: MessageSquare, label: "commented" },
  "comment-edited": { icon: Pencil, label: "edited a comment" },
  "comment-deleted": { icon: Trash2, label: "deleted a comment" },
  "attachment-added": { icon: Inbox, label: "attached" },
  "attachment-removed": { icon: Link2, label: "removed an attachment" },
};

/** Human phrase for the change payload. */
const describe = (entry) => {
  switch (entry.type) {
    case "task-status":
      return (
        <>
          changed status from{" "}
          <strong>{TASK_STATUS[entry.from]?.label ?? entry.from ?? "—"}</strong> to{" "}
          <strong>{TASK_STATUS[entry.to]?.label ?? entry.to ?? "—"}</strong>
        </>
      );
    case "task-assigned":
      return (
        <>
          assigned <strong>{entry.to ?? "a member"}</strong>
        </>
      );
    case "task-unassigned":
      return (
        <>
          unassigned <strong>{entry.from ?? "the assignee"}</strong>
        </>
      );
    case "attachment-added":
      return (
        <>
          added attachment <strong>{entry.to}</strong>
        </>
      );
    case "attachment-removed":
      return (
        <>
          removed attachment <strong>{entry.from}</strong>
        </>
      );
    case "task-created":
      return <>created this task</>;
    case "task-updated":
      return <>updated {entry.summary || "this task"}</>;
    case "comment-added":
      return (
        <>
          commented: <span className="text-slate-500">“{entry.summary}”</span>
        </>
      );
    case "comment-edited":
      return <span className="text-slate-500">“{entry.summary}”</span>;
    case "comment-deleted":
      return <span className="text-slate-500">“{entry.summary}”</span>;
    default:
      return entry.summary || null;
  }
};

/**
 * Task activity history (GET /api/tasks/:id/activity) — who created or
 * updated the task, status changes, assignments, comments and attachments,
 * newest first. Loads once when the modal opens.
 */
export default function ActivityTimeline({ taskId, refreshKey }) {
  const { user } = useAuth();
  const [activity, setActivity] = useState(null); // null = loading

  useEffect(() => {
    if (!taskId) return undefined;
    let cancelled = false;
    setActivity(null);
    getTaskActivity(taskId)
      .then((data) => {
        if (!cancelled) setActivity(data.activity || []);
      })
      .catch(() => {
        if (!cancelled) setActivity([]);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId, refreshKey]);

  return (
    <section>
      <h3 className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-slate-800">
        <Inbox className="h-4 w-4 text-brand-500" />
        Activity
        {activity && activity.length > 0 ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">
            {activity.length}
          </span>
        ) : null}
      </h3>

      {activity === null ? (
        <div className="space-y-2 py-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <p key={i} className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ) : activity.length === 0 ? (
        <p className="text-xs text-slate-400">
          Nothing yet — changes, comments and attachments will show up here.
        </p>
      ) : (
        <ul className="scrollbar-thin max-h-64 space-y-2.5 overflow-y-auto pr-1">
          {activity.map((entry) => {
            const Icon = TYPE_META[entry.type]?.icon ?? Inbox;
            const isMine = entry.actor?.id === user?.id;
            return (
              <li key={entry.id} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <Icon className="h-3 w-3" />
                </span>
                <p className="min-w-0 flex-1 text-xs leading-5 text-slate-600">
                  <span
                    className={isMine ? "font-semibold text-slate-800" : "font-semibold"}
                    title={entry.actor?.email ?? ""}
                  >
                    {isMine ? "You" : entry.actor?.name ?? "Someone"}{" "}
                  </span>
                  {describe(entry)}
                  <span className="ml-1.5 text-[10px] text-slate-400">
                    · {relativeTime(entry.createdAt)}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
