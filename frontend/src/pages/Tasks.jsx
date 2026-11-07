import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleAlert,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";

import Alert from "../components/ui/Alert.jsx";
import Button from "../components/ui/Button.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import TaskRow from "../components/tasks/TaskRow.jsx";
import TaskFilters from "../components/tasks/TaskFilters.jsx";
import TaskFormModal from "../components/tasks/TaskFormModal.jsx";
import TaskDetailModal from "../components/tasks/TaskDetailModal.jsx";
import { deleteTask, setTaskStatus } from "../api/tasks.js";
import { getProjects } from "../api/projects.js";
import { useTasks } from "../hooks/useTasks.js";
import { useAuth } from "../context/AuthContext.jsx";

const EMPTY_FILTERS = {
  q: "",
  status: "",
  priority: "",
  assignee: "",
  label: "",
  projectId: "",
  sort: "due",
  order: "asc",
};

/**
 * Tasks — the full task management list.
 * Server-side search / filters / sort, create + edit dialog, detail dialog
 * with subtasks & attachments, inline status toggles, and delete with
 * confirmation. Every action respects project role + assignment rules.
 */
export default function Tasks() {
  const { user } = useAuth();

  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const [projects, setProjects] = useState(null);
  const [projectsError, setProjectsError] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const { tasks, loading, error, refetch } = useTasks(filters);
  const list = tasks ?? [];

  // ---------- projects (filter dropdown + assignee picker + create form) ----------
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

  // ---------- debounced search (server-side q) ----------
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) =>
        prev.q === searchInput.trim() ? prev : { ...prev, q: searchInput.trim() }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const onFilterChange = useCallback((partial) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setFilters(EMPTY_FILTERS);
  }, []);

  // Close the detail dialog if its task disappears (deleted elsewhere).
  useEffect(() => {
    if (selectedId && tasks && !tasks.some((t) => t.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, tasks]);

  const selected = useMemo(
    () => (selectedId ? (tasks || []).find((t) => t.id === selectedId) ?? null : null),
    [selectedId, tasks]
  );

  const filtersActive = Boolean(
    filters.q ||
      filters.status ||
      filters.priority ||
      filters.assignee ||
      filters.label ||
      filters.projectId
  );

  const labelOptions = useMemo(() => {
    const set = new Set();
    for (const task of list) for (const label of task.labels || []) set.add(label);
    return [...set].sort();
  }, [list]);

  const visibleProjects = useMemo(
    () => (projects || []).filter((p) => p.status !== "archived"),
    [projects]
  );

  // ---------- mutations ----------
  /** Page-level action: run, refresh list, surface errors in the banner. */
  const runAction = async (fn) => {
    setActionError(null);
    try {
      await fn();
      await refetch(false);
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Something went wrong. Please try again."
      );
    }
  };

  const handleToggleStatus = (task) =>
    runAction(() =>
      setTaskStatus(task.id, task.status === "done" ? "todo" : "done")
    );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await runAction(() => deleteTask(deleteTarget.id));
    setDeleting(false);
    setDeleteTarget(null);
    if (selectedId === deleteTarget.id) setSelectedId(null);
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (task) => {
    setEditing(task);
    setSelectedId(null);
    setFormOpen(true);
  };

  const handleSaved = () => {
    refetch(false);
  };

  const hasProjects = (projects?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Tasks</h2>
          <p className="mt-1 text-sm text-slate-500">
            {loading
              ? "Loading tasks…"
              : `${list.length} task${list.length === 1 ? "" : "s"}${
                  filtersActive ? " match your filters" : " across your projects"
                }`}
          </p>
        </div>

        <Button onClick={openCreate} disabled={projects !== null && !hasProjects}>
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Action errors */}
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

      {/* Projects failed to load (needed for the create form + filters) */}
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

      {/* Search + filters + sort */}
      <TaskFilters
        search={searchInput}
        onSearchChange={setSearchInput}
        filters={filters}
        onFilterChange={onFilterChange}
        onClear={clearFilters}
        projects={projects}
        labelOptions={labelOptions}
      />

      {/* Loading */}
      {loading && tasks === null ? (
        <div className="overflow-hidden rounded-panel border border-slate-200/70 bg-surface shadow-soft">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0"
            >
              <Skeleton className="h-[21px] w-[21px] rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="hidden h-6 w-16 rounded-full sm:block" />
              <Skeleton className="h-7 w-7 rounded-full" />
            </div>
          ))}
        </div>
      ) : null}

      {/* Error */}
      {error && !loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="max-w-md rounded-panel border border-slate-200/70 bg-surface p-8 text-center shadow-soft">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
              <CircleAlert className="h-6 w-6" />
            </span>
            <h3 className="text-lg font-bold text-slate-900">Couldn’t load tasks</h3>
            <p className="mt-2 text-sm text-slate-500">
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

      {/* Empty — no tasks at all */}
      {tasks && list.length === 0 && !error && !filtersActive ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks yet"
          description="Create your first task to start tracking work across your projects."
          action={
            <Button onClick={openCreate} disabled={!hasProjects}>
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          }
          className="py-16"
        />
      ) : null}

      {/* Empty — filters matched nothing */}
      {tasks && list.length === 0 && !error && filtersActive ? (
        <EmptyState
          icon={Search}
          title="No tasks match"
          description="Try a different search term or clear the filters."
          action={
            <Button variant="ghost" onClick={clearFilters}>
              Clear search & filters
            </Button>
          }
          className="py-16"
        />
      ) : null}

      {/* Task list */}
      {tasks && list.length > 0 ? (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-panel border border-slate-200/70 bg-surface shadow-soft">
          {list.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              user={user}
              onOpen={(t) => setSelectedId(t.id)}
              onToggleStatus={handleToggleStatus}
              onEdit={openEdit}
              onDelete={(t) => setDeleteTarget(t)}
            />
          ))}
        </div>
      ) : null}

      {/* Create / edit dialog */}
      <TaskFormModal
        open={formOpen}
        task={editing}
        projects={projects}
        onClose={() => setFormOpen(false)}
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
