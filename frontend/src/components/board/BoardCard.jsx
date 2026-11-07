import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarClock,
  GripVertical,
  Link2,
  ListChecks,
  MessageSquare,
  UserRound,
} from "lucide-react";

import { TASK_PRIORITY, TASK_STATUS, DUE_TONES } from "../../utils/projectColors.js";
import { dueLabel, initialsOf } from "../../utils/dates.js";
import { cn } from "../../utils/cn.js";

/**
 * One draggable kanban card. Uses @dnd-kit/sortable so it animates while
 * reordered and reports its column through `data.current.status`.
 * The whole card opens the detail dialog on click (drags never trigger it).
 */
export default function BoardCard({ task, isOverlay = false, disabled = false, onClick }) {
  const sortable = useSortable({
    id: task.id,
    data: { type: "card", status: task.status },
    disabled: isOverlay || disabled,
  });
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = sortable;

  const priority = TASK_PRIORITY[task.priority] ?? TASK_PRIORITY.medium;
  const status = TASK_STATUS[task.status] ?? TASK_STATUS.todo;
  const due = dueLabel(task.dueDate);
  const subs = task.subtaskProgress || { total: 0, completed: 0 };
  const commentCount = task.commentCount ?? (task.comments || []).length;
  const attachmentCount = (task.attachments || []).length;
  const isDone = task.status === "done";

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Open task ${task.title}`}
      onKeyDown={(event) => {
        if (event.key === "Enter") onClick?.();
      }}
      className={cn(
        "group relative rounded-panel border bg-surface p-3.5 text-left shadow-soft transition-all",
        disabled && !isOverlay
          ? "cursor-default"
          : "cursor-grab hover:-translate-y-0.5 hover:border-brand-200",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/10",
        isDragging || isOverlay
          ? "border-brand-300 shadow-elevated ring-4 ring-brand-500/10"
          : "border-slate-200/70",
        isDragging && "opacity-40"
      )}
    >
      {/* Drag handle affordance */}
      <GripVertical className="pointer-events-none absolute left-1 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-slate-200 transition-colors group-hover:text-slate-300 lg:block" />

      {/* Title */}
      <div className="mb-2 pl-2">
        <h3
          className={cn(
            "line-clamp-2 text-sm font-semibold leading-5",
            isDone ? "text-slate-400 line-through" : "text-slate-800"
          )}
        >
          {task.title}
        </h3>
      </div>

      {/* Labels */}
      {(task.labels || []).length > 0 ? (
        <div className="mb-2 flex flex-wrap items-center gap-1 pl-2">
          {task.labels.slice(0, 3).map((label) => (
            <span
              key={label}
              className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600"
            >
              {label}
            </span>
          ))}
          {task.labels.length > 3 ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              +{task.labels.length - 3}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-1.5 pl-2 text-[11px] font-medium text-slate-500">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            priority.className
          )}
        >
          {priority.label}
        </span>

        {due ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
              DUE_TONES[due.tone]
            )}
          >
            <CalendarClock className="h-3 w-3" />
            {due.text}
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

        {attachmentCount > 0 ? (
          <span
            className="inline-flex items-center gap-1"
            title={`${attachmentCount} attachment(s)`}
          >
            <Link2 className="h-3.5 w-3.5" />
            {attachmentCount}
          </span>
        ) : null}

        {commentCount > 0 ? (
          <span
            className="inline-flex items-center gap-1"
            title={`${commentCount} comment(s)`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {commentCount}
          </span>
        ) : null}
      </div>

      {/* Assignee */}
      <div className="mt-2.5 flex items-center justify-between pl-2">
        {task.assignee ? (
          <span
            title={`Assigned to ${task.assignee.name}`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-[9px] font-bold text-white ring-2 ring-white"
          >
            {initialsOf(task.assignee.name)}
          </span>
        ) : (
          <span
            title="Unassigned"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400"
          >
            <UserRound className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );
}
