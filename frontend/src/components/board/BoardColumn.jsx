import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";

import BoardCard from "./BoardCard.jsx";
import { TASK_STATUS, STATUS_HEX } from "../../utils/projectColors.js";
import { canUpdateTaskProgress } from "../../utils/permissions.js";
import { cn } from "../../utils/cn.js";

/**
 * One kanban column: droppable surface (handles card drags in AND empty
 * columns), sticky header with color dot + live count, a per-column
 * "add task" button, and the sortable list of cards.
 */
export default function BoardColumn({
  status,
  tasks,
  authUserId,
  lockDrag = false,
  onCreate,
  onOpenTask,
  filtersActive,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${status}`,
    data: { type: "column", status },
  });
  const meta = TASK_STATUS[status] ?? { label: status };

  return (
    <section
      className={cn(
        "flex h-full w-72 shrink-0 flex-col rounded-panel border bg-slate-50/80 shadow-soft transition-colors sm:w-[19rem]",
        isOver ? "border-brand-300 bg-brand-50/60" : "border-slate-200/70"
      )}
    >
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: STATUS_HEX[status] }}
        />
        <h2 className="flex-1 truncate text-sm font-bold text-slate-800">
          {meta.label}
        </h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">
          {tasks.length}
        </span>
        <button
          type="button"
          onClick={() => onCreate(status)}
          aria-label={`Add task to ${meta.label}`}
          title={`Add task to ${meta.label}`}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
        >
          <Plus className="h-4 w-4" />
        </button>
      </header>

      {/* Cards */}
      <div
        ref={setNodeRef}
        data-status={status}
        className="scrollbar-thin flex min-h-[6rem] flex-1 flex-col gap-2.5 overflow-y-auto p-3"
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <BoardCard
              key={task.id}
              task={task}
              disabled={lockDrag || !canUpdateTaskProgress(task.myRole, task, authUserId)}
              onClick={() => onOpenTask(task)}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
            {filtersActive
              ? "No matching tasks"
              : `Nothing here yet — drop a card or add one`}
          </p>
        ) : null}
      </div>
    </section>
  );
}
