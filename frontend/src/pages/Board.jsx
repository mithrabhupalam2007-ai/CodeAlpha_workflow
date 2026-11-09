import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CircleAlert, KanbanSquare, Lock, Plus, RefreshCw, Search } from "lucide-react";

import Alert from "../components/ui/Alert.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import BoardColumn from "../components/board/BoardColumn.jsx";
import BoardCard from "../components/board/BoardCard.jsx";
import TaskFilters from "../components/tasks/TaskFilters.jsx";
import TaskFormModal from "../components/tasks/TaskFormModal.jsx";
import TaskDetailModal from "../components/tasks/TaskDetailModal.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import { deleteTask, moveTask } from "../api/tasks.js";
import { getProjects } from "../api/projects.js";
import { useTasks } from "../hooks/useTasks.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useProjectRoom, useSocket } from "../context/SocketContext.jsx";

const COLUMNS = ["todo", "in-progress", "in-review", "done"];

const EMPTY_FILTERS = {
  q: "",
  status: "",
  priority: "",
  assignee: "",
  label: "",
  projectId: "",
};

/**
 * Board — premium drag & drop kanban across four status columns.
 * Live order comes from the server (`sort=position`); cross-column moves
 * are applied optimistically during `onDragOver`, same-column reordering
 * finalizes on `onDragEnd`, and everything persists via
 * PATCH /api/tasks/:id/move — rolling back the exact previous layout
 * (with an error banner) if the request fails. Dragging is locked while
 * card-hiding filters are active so `orderedIds` matches exactly what the
 * server knows about each column.
 */
export default function Board() {
  const { user } = useAuth();

  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // Filters that hide cards also lock dragging (orderedIds must be complete).
  const lockDrag = Boolean(
    filters.q || filters.status || filters.priority || filters.assignee || filters.label
  );

  const [projects, setProjects] = useState(null);
  const [projectsError, setProjectsError] = useState(null);

  const [board, setBoard] = useState(null); // optimistic mirror of `tasks`
  const [activeTask, setActiveTask] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // task being edited (null = create)
  const [formDefaults, setFormDefaults] = useState({ status: "todo", projectId: "" });
  const [selectedId, setSelectedId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { tasks, setTasks, loading, error, refetch } = useTasks({
    ...filters,
    sort: "position",
    order: "asc",
  });
  const list = board ?? tasks ?? [];

  const boardRef = useRef(null);
  useEffect(() => {
    boardRef.current = tasks;
    setBoard(tasks);
  }, [tasks]);

  const activeTaskRef = useRef(activeTask);
  useEffect(() => {
    activeTaskRef.current = activeTask;
  }, [activeTask]);

  const suppressClick = useRef(false);
  const dragSnapshot = useRef(null); // board layout when the drag started
  const dragMoved = useRef(false); // a cross-column beat happened during dragOver

  // Subscribe to project rooms for real-time updates
  const roomIds = useMemo(() => {
    if (filters.projectId) return [filters.projectId];
    return (projects || []).filter((p) => p.status !== "archived").map((p) => p.id);
  }, [filters.projectId, projects]);
  useProjectRoom(roomIds);

  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const onTaskCreated = ({ projectId }) => {
      if (filters.projectId && filters.projectId !== projectId) return;
      refetch(false);
    };

    const onTaskUpdated = ({ taskId, task: updated }) => {
      if (activeTaskRef.current?.id === taskId) return;
      setBoard((prev) => {
        if (!prev) return prev;
        const exists = prev.some((t) => t.id === taskId);
        if (!exists) return prev;
        const next = prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t));
        boardRef.current = next;
        return next;
      });
      refetch(false);
    };

    const onTaskMoved = ({ taskId }) => {
      if (activeTaskRef.current?.id === taskId) return;
      refetch(false);
    };

    const onTaskDeleted = ({ taskId }) => {
      if (selectedId === taskId) setSelectedId(null);
      if (deleteTarget?.id === taskId) setDeleteTarget(null);
      setBoard((prev) => {
        if (!prev) return prev;
        const next = prev.filter((t) => t.id !== taskId);
        boardRef.current = next;
        return next;
      });
      refetch(false);
    };

    const onTaskCommented = ({ taskId, task: commented }) => {
      setBoard((prev) => {
        if (!prev) return prev;
        const exists = prev.some((t) => t.id === taskId);
        if (!exists) return prev;
        const next = prev.map((t) =>
          t.id === taskId ? { ...t, comments: commented.comments } : t
        );
        boardRef.current = next;
        return next;
      });
      refetch(false);
    };

    socket.on("task:created", onTaskCreated);
    socket.on("task:updated", onTaskUpdated);
    socket.on("task:moved", onTaskMoved);
    socket.on("task:deleted", onTaskDeleted);
    socket.on("task:commented", onTaskCommented);

    return () => {
      socket.off("task:created", onTaskCreated);
      socket.off("task:updated", onTaskUpdated);
      socket.off("task:moved", onTaskMoved);
      socket.off("task:deleted", onTaskDeleted);
      socket.off("task:commented", onTaskCommented);
    };
  }, [socket, filters.projectId, refetch, selectedId, deleteTarget]);

  // ---------- projects (filter dropdown + create form) ----------
  const loadProjects = useCallback(async () => {
    setProjectsError(null);
    try {
      const data = await getProjects();
      setProjects(data.projects);
    } catch (err) {
      setProjectsError(err);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // ---------- debounced search ----------
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) =>
        prev.q === searchInput.trim() ? prev : { ...prev, q: searchInput.trim() }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const onFilterChange = useCallback((partial) => {
    setActionError(null);
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setActionError(null);
    setFilters(EMPTY_FILTERS);
  }, []);

  const filtersActive = Boolean(
    filters.q || filters.status || filters.priority || filters.assignee || filters.label
  );

  // ---------- derive columns (order = array order within each status) ----------
  const columns = useMemo(() => {
    const map = { todo: [], "in-progress": [], "in-review": [], done: [] };
    for (const task of board ?? []) {
      if (map[task.status]) map[task.status].push(task);
    }
    return map;
  }, [board]);

  const visibleProjects = useMemo(
    () => (projects || []).filter((p) => p.status !== "archived"),
    [projects]
  );

  const hasProjects = visibleProjects.length > 0;

  const labelOptions = useMemo(() => {
    const set = new Set();
    for (const task of list) for (const label of task.labels || []) set.add(label);
    return [...set].sort();
  }, [list]);

  const selected = useMemo(
    () => (selectedId ? list.find((t) => t.id === selectedId) ?? null : null),
    [selectedId, list]
  );

  // ---------- dialogs ----------
  const openCreate = (status = "todo") => {
    setEditing(null);
    setFormDefaults({ status, projectId: filters.projectId });
    setFormOpen(true);
  };

  const openEdit = (task) => {
    setSelectedId(null);
    setEditing(task);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const handleSaved = () => refetch(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteTask(deleteTarget.id);
      await refetch(false);
      if (selectedId === deleteTarget.id) setSelectedId(null);
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Something went wrong. Please try again."
      );
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ---------- drag helpers (pure — operate on the flat task array) ----------
  /** Reorder inside one column; returns `cur` unchanged when it's a no-op. */
  const applySameColumnMove = (cur, activeId, overId) => {
    const col = cur.find((t) => t.id === activeId)?.status;
    if (!col) return cur;
    const colTasks = cur.filter((t) => t.status === col);
    const from = colTasks.findIndex((t) => t.id === activeId);
    const to = colTasks.findIndex((t) => t.id === overId);
    if (from === -1 || to === -1 || from === to) return cur;
    const moved = arrayMove(colTasks, from, to);
    let k = 0;
    return cur.map((t) => (t.status === col ? moved[k++] : t));
  };

  /** Move a card into another column, before the `overId` card (or at end). */
  const applyCrossColumnMove = (cur, activeId, toCol, overId) => {
    const active = cur.find((t) => t.id === activeId);
    if (!active || active.status === toCol) return cur;

    const moved = { ...active, status: toCol };
    const destOriginal = cur.filter((t) => t.status === toCol);
    const fromList = cur.filter((t) => t.status === active.status && t.id !== activeId);
    const insertAt = overId ? destOriginal.findIndex((t) => t.id === overId) : -1;

    let fi = 0;
    let ti = 0;
    let inserted = false;

    const next = cur.flatMap((t) => {
      if (t.id === activeId) return []; // leaves its old spot
      if (t.status === active.status) return [fromList[fi++]];
      if (t.status === toCol) {
        const out = [];
        if (!inserted && ti === insertAt) {
          out.push(moved);
          inserted = true;
        }
        out.push(destOriginal[ti]);
        ti += 1;
        return out;
      }
      return [t];
    });
    if (!inserted) next.push(moved); // empty column drop (or append at end)
    return next;
  };

  /** Persist the new layout; roll back the snapshot on failure. */
  const persistMove = async (snapshot, movedId, destCol, next) => {
    const colIndex = next.findIndex((t) => t.id === movedId);
    if (colIndex === -1) return;
    const payload = {
      ...(destCol ? { status: destCol } : {}),
      orderedIds: next
        .filter((t) => t.status === next[colIndex].status)
        .map((t) => t.id),
    };
    try {
      await moveTask(movedId, payload);
      await refetch(false);
    } catch (err) {
      // Roll back to the exact layout before the drag.
      const previous = JSON.parse(snapshot);
      boardRef.current = previous;
      setBoard(previous);
      setActionError(
        err.response?.data?.message ||
          "Couldn’t move that card. Check your connection and try again."
      );
    }
  };

  /** Undo any dragOver mutations back to the layout at drag start. */
  const rollbackDrag = () => {
    if (!dragSnapshot.current) return;
    const previous = JSON.parse(dragSnapshot.current);
    boardRef.current = previous;
    setBoard(previous);
  };

  // ---------- dnd ----------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event) => {
    suppressClick.current = true; // clicks fired right after a drag are ignored
    setActionError(null);
    dragSnapshot.current = boardRef.current ? JSON.stringify(boardRef.current) : null;
    dragMoved.current = false;
    const task = boardRef.current?.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  };

  /** Same-column reorder previews via sortable transforms; only cross-column
   * moves mutate state here (the card is inserted before the hovered card). */
  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over || lockDrag || over.id === active.id) return;

    const cur = boardRef.current;
    if (!cur) return;
    if (!cur.some((t) => t.id === active.id)) return;

    const overData = over.data.current ?? {};
    const overCol =
      overData.type === "column"
        ? overData.status
        : cur.find((t) => t.id === over.id)?.status;
    if (!overCol) return;

    const next = applyCrossColumnMove(
      cur,
      active.id,
      overCol,
      overData.type === "card" ? over.id : null
    );
    if (next !== cur) {
      boardRef.current = next;
      setBoard(next);
      dragMoved.current = true;
      setActiveTask((prev) =>
        prev && prev.id === active.id ? { ...prev, status: overCol } : prev
      );
    }
  };

  /** Finalize: same-column reorder (or refine the cross-column drop), then persist. */
  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveTask(null);
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 200);
    if (!over || lockDrag) return;

    const cur = boardRef.current;
    if (!cur) return;
    const task = cur.find((t) => t.id === active.id);
    if (!task) return;

    const overData = over.data.current ?? {};
    const overCol =
      overData.type === "column"
        ? overData.status
        : cur.find((t) => t.id === over.id)?.status;
    if (!overCol) return;

    const crossed = task.status !== overCol;
    let next = cur;

    if (!crossed && overData.type === "card" && over.id !== active.id) {
      // True same-column reorder — final placement from the drop target.
      next = applySameColumnMove(cur, active.id, over.id);
    }
    if (crossed) {
      next = applyCrossColumnMove(
        cur,
        active.id,
        overCol,
        overData.type === "card" ? over.id : null
      );
    }
    if (next === cur && !crossed && !dragMoved.current) {
      dragSnapshot.current = null;
      return;
    }

    const destCol = crossed ? overCol : null;
    if (next !== cur) {
      boardRef.current = next;
      setBoard(next);
    }
    const snapshot = dragSnapshot.current;
    dragSnapshot.current = null;
    dragMoved.current = false;
    persistMove(snapshot, active.id, destCol, next);
  };

  const handleDragCancel = () => {
    setActiveTask(null);
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 200);
    if (dragMoved.current) rollbackDrag(); // undo the previewed cross-column move
    dragSnapshot.current = null;
    dragMoved.current = false;
  };

  const handleCardClick = (task) => {
    if (suppressClick.current) return;
    setSelectedId(task.id);
  };

  // ---------- render ----------
  const showBoard = board && (list.length > 0 || filtersActive) && !error;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-main">Board</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {loading && tasks === null
              ? "Loading board…"
              : `${list.length} task${list.length === 1 ? "" : "s"} across all stages`}
          </p>
        </div>
        <Button onClick={() => openCreate("todo")} disabled={!hasProjects}>
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Action errors (moves, deletes) */}
      {actionError ? (
        <Alert variant="error">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-xs font-semibold underline underline-offset-2"
            >
              Dismiss
            </button>
          </div>
        </Alert>
      ) : null}

      {/* Projects failed to load */}
      {projectsError ? (
        <Alert variant="error">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Couldn’t load your projects for filtering.</span>
            <button
              type="button"
              onClick={loadProjects}
              className="text-xs font-semibold underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        </Alert>
      ) : null}

      {/* Search + filters */}
      <TaskFilters
        search={searchInput}
        onSearchChange={setSearchInput}
        filters={filters}
        onFilterChange={onFilterChange}
        onClear={clearFilters}
        projects={projects}
        labelOptions={labelOptions}
        showSort={false}
      />

      {/* Load error */}
      {error && !loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="max-w-md rounded-panel border border-border bg-surface p-8 text-center shadow-card">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-950/20 text-rose-500">
              <CircleAlert className="h-6 w-6" />
            </span>
            <h3 className="text-lg font-bold text-text-main">Couldn’t load the board</h3>
            <p className="mt-2 text-sm text-text-secondary">
              {error?.response?.data?.message ||
                "Check that the API is running and try again."}
            </p>
            <Button onClick={() => refetch()} className="mt-5">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        </div>
      ) : null}

      {/* The board — Vertical Lists */}
      {showBoard ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((status) => (
              <BoardColumn
                key={status}
                status={status}
                tasks={columns[status]}
                authUserId={user?.id}
                lockDrag={lockDrag}
                onCreate={openCreate}
                onOpenTask={handleCardClick}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTask ? (
              <div className="w-72 rotate-1 shadow-glow sm:w-[18rem]">
                <BoardCard task={activeTask} isOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : null}

      {/* Create / edit dialog */}
      <TaskFormModal
        open={formOpen}
        task={editing}
        projects={projects}
        defaults={formDefaults}
        onClose={closeForm}
        onSaved={handleSaved}
      />

      {/* Detail dialog */}
      <TaskDetailModal
        open={Boolean(selected)}
        task={selected}
        projects={projects}
        user={user}
        onClose={() => setSelectedId(null)}
        onEdit={openEdit}
        onDelete={(t) => setDeleteTarget(t)}
        onChanged={() => refetch(false)}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete task"
        message={
          deleteTarget
            ? `“${deleteTarget.title}” and its subtasks and attachments will be permanently deleted. This can’t be undone.`
            : ""
        }
        confirmLabel="Delete task"
      />
    </div>
  );
}
