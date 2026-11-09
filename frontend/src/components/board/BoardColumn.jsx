import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import BoardCard from "./BoardCard.jsx";
import { TASK_STATUS } from "../../utils/projectColors.js";
import { canUpdateTaskProgress } from "../../utils/permissions.js";
import { cn } from "../../utils/cn.js";

/**
 * Single status section for the vertical list view.
 */
export default function BoardColumn({
  status,
  tasks,
  authUserId,
  lockDrag = false,
  onOpenTask,
}) {
  const { setNodeRef } = useDroppable({
    id: `col-${status}`,
    data: { type: "column", status },
  });
  const meta = TASK_STATUS[status] ?? { label: status };

  if (tasks.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
        {meta.label} ({tasks.length})
      </h3>

      <div ref={setNodeRef} className="space-y-3">
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
      </div>
    </section>
  );
}
