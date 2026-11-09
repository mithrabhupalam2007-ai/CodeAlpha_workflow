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
        "group relative rounded-panel border bg-surface p-4 text-left shadow-soft transition-all",
        disabled && !isOverlay
          ? "cursor-default"
          : "cursor-grab hover:border-brand-500",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        isDragging || isOverlay
          ? "border-brand-500 shadow-glow"
          : "border-border",
        isDragging && "opacity-40"
      )}
    >
      {/* Drag handle affordance */}
      <GripVertical className="pointer-events-none absolute left-1 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-border transition-colors group-hover:text-brand-500 lg:block" />

      {/* Title */}
      <div className="mb-2 pl-4">
        <h3
          className={cn(
            "text-sm font-semibold leading-5 text-text-main",
            isDone && "text-text-secondary line-through"
          )}
        >
          {task.title}
        </h3>
        {task.description && (
          <p className="mt-1 line-clamp-1 text-xs text-text-secondary">
            {task.description}
          </p>
        )}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 pl-4 text-[11px] font-medium text-text-secondary">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-semibold",
            priority.className.replace(/bg-slate-100/g, "bg-border")
          )}
        >
          {priority.label}
        </span>

        {due && (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {due.text}
          </span>
        )}

        <span className="rounded-full bg-border px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
          {status.label}
        </span>
      </div>

      {/* Assignee */}
      <div className="mt-3 flex items-center justify-between pl-4">
        {task.assignee ? (
          <span
            title={`Assigned to ${task.assignee.name}`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white"
          >
            {initialsOf(task.assignee.name)}
          </span>
        ) : (
          <span
            title="Unassigned"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-text-secondary"
          >
            <UserRound className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );
}
