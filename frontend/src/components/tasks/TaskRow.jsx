import {
  CalendarClock,
  Check,
  FolderKanban,
  Link2,
  ListChecks,
  MessageSquare,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react";

import { TASK_PRIORITY, TASK_STATUS, DUE_TONES } from "../../utils/projectColors.js";
import { dueLabel, initialsOf } from "../../utils/dates.js";
import {
  canEditTasks,
  canUpdateTaskProgress,
} from "../../utils/permissions.js";
import { cn } from "../../utils/cn.js";

/**
 * One task in the list: status toggle, title, labels, project, progress,
 * priority / due / assignee chips, and permission-aware hover actions.
 * Clicking the row opens the detail dialog.
 */
export default function TaskRow({
  task,
  user,
  onOpen,
  onToggleStatus,
  onEdit,
  onDelete,
}) {
  const canEdit = canEditTasks(task.myRole);
  const canProgress = canUpdateTaskProgress(task.myRole, task, user?.id);

  const priority = TASK_PRIORITY[task.priority] ?? TASK_PRIORITY.medium;
  const status = TASK_STATUS[task.status] ?? TASK_STATUS.todo;
  const due = dueLabel(task.dueDate);
  const isDone = task.status === "done";
  const subs = task.subtaskProgress || { total: 0, completed: 0 };

  const stop = (fn) => (event) => {
    event.stopPropagation();
    fn();
  };

  const statusControl = (
    <button
      type="button"
      disabled={!canProgress}
      onClick={stop(() => onToggleStatus(task))}
      aria-label={isDone ? `Reopen ${task.title}` : `Mark ${task.title} done`}
      title={
        canProgress
          ? isDone
            ? "Mark as to do"
            : "Mark as done"
          : "Only editors or the assignee can change status"
      }
      className={cn(
        "mt-0.5 flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-full border-2 transition-all",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20",
        isDone
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50",
        !canProgress && "cursor-not-allowed opacity-60"
      )}
    >
      {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
    </button>
  );

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Open task ${task.title}`}
      onClick={() => onOpen(task)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(task);
      }}
      className="group animate-slide-up cursor-pointer px-4 py-3.5 transition-colors hover:bg-slate-50/70 focus-visible:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/10 sm:px-5"
    >
      <div className="flex items-start gap-3">
        {statusControl}

        <div className="min-w-0 flex-1">
          {/* Title + chips */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3
              className={cn(
                "text-sm font-semibold leading-5",
                isDone ? "text-slate-400 line-through" : "text-slate-800"
              )}
            >
              {task.title}
            </h3>
            {(task.labels || []).slice(0, 3).map((label) => (
              <span
                key={label}
                className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600"
              >
                {label}
              </span>
            ))}
            {(task.labels || []).length > 3 ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                +{task.labels.length - 3}
              </span>
            ) : null}
          </div>

          {/* Meta line */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-slate-500">
            {task.project ? (
              <span className="inline-flex max-w-[10rem] items-center gap-1 truncate text-slate-400">
                <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{task.project.name}</span>
              </span>
            ) : null}

            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                status.className
              )}
            >
              {status.label}
            </span>

            {subs.total > 0 ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  subs.completed === subs.total && "text-emerald-600"
                )}
                title={`${subs.completed} of ${subs.total} subtasks complete`}
              >
                <ListChecks className="h-3.5 w-3.5" />
                {subs.completed}/{subs.total}
              </span>
            ) : null}

            {(task.attachments || []).length > 0 ? (
              <span
                className="inline-flex items-center gap-1"
                title={`${task.attachments.length} attachment(s)`}
              >
                <Link2 className="h-3.5 w-3.5" />
                {task.attachments.length}
              </span>
            ) : null}

            {(task.commentCount ?? 0) > 0 ? (
              <span
                className="inline-flex items-center gap-1"
                title={`${task.commentCount} comment(s)`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {task.commentCount}
              </span>
            ) : null}

            {task.startDate && !isDone ? (
              <span
                className="inline-flex items-center gap-1"
                title={`Starts ${new Date(task.startDate).toLocaleDateString()}`}
              >
                <CalendarClock className="h-3.5 w-3.5" />
                starts {new Date(task.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            ) : null}
          </div>
        </div>

        {/* Right side: priority, due, assignee, actions */}
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "hidden rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide sm:inline-block",
              priority.className
            )}
          >
            {priority.label}
          </span>

          {due ? (
            <span
              className={cn(
                "hidden items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold md:inline-flex",
                DUE_TONES[due.tone]
              )}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {due.text}
            </span>
          ) : (
            <span className="hidden items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-400 md:inline-flex">
              <CalendarClock className="h-3.5 w-3.5" />
              No due date
            </span>
          )}

          {task.assignee ? (
            <span
              title={`Assigned to ${task.assignee.name}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-[10px] font-bold text-white ring-2 ring-white"
            >
              {initialsOf(task.assignee.name)}
            </span>
          ) : (
            <span
              title="Unassigned"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-slate-400"
            >
              <UserRound className="h-3.5 w-3.5" />
            </span>
          )}

          {canEdit ? (
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <button
                type="button"
                onClick={stop(() => onEdit(task))}
                aria-label={`Edit ${task.title}`}
                title="Edit task"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={stop(() => onDelete(task))}
                aria-label={`Delete ${task.title}`}
                title="Delete task"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
