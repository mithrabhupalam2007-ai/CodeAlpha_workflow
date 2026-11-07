import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  CircleAlert,
  FolderKanban,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";

import Alert from "../components/ui/Alert.jsx";
import Button from "../components/ui/Button.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import ProjectFormModal from "../components/projects/ProjectFormModal.jsx";
import ProjectActionsMenu from "../components/projects/ProjectActionsMenu.jsx";
import InvitationsBanner from "../components/projects/InvitationsBanner.jsx";
import { getProjects, archiveProject, restoreProject, deleteProject } from "../api/projects.js";
import { PROJECT_STATUS, projectColor } from "../utils/projectColors.js";
import { formatDate, initialsOf } from "../utils/dates.js";
import { cn } from "../utils/cn.js";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "on-hold", label: "On hold" },
  { key: "completed", label: "Completed" },
  { key: "archived", label: "Archived" },
];

/**
 * Projects grid — real data from GET /api/projects.
 * Search + status filters, create/edit/archive/restore/delete actions,
 * invitation banner, and full loading / error / empty states.
 */
export default function Projects() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // project being edited (null = create)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjects();
      setProjects(data.projects);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const list = projects ?? [];

  // Client-side search (name + description) combined with the status filter
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return list.filter((project) => {
      const matchesStatus =
        filter === "all" ? true : project.status === filter;
      const matchesSearch =
        !query ||
        project.name.toLowerCase().includes(query) ||
        (project.description || "").toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [list, filter, search]);

  const countFor = (key) =>
    key === "all" ? list.length : list.filter((p) => p.status === key).length;

  // ---------- actions ----------
  const runAction = async (fn) => {
    setActionError(null);
    try {
      await fn();
      await fetchProjects();
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Something went wrong. Please try again."
      );
    }
  };

  const handleArchive = (project) =>
    runAction(() => archiveProject(project.id));
  const handleRestore = (project) =>
    runAction(() => restoreProject(project.id));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await runAction(() => deleteProject(deleteTarget.id));
    setDeleting(false);
    setDeleteTarget(null);
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (project) => {
    setEditing(project);
    setFormOpen(true);
  };

  const statusOf = (status) => PROJECT_STATUS[status] ?? PROJECT_STATUS.active;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Projects
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {loading
              ? "Loading your workspace…"
              : `${list.length} project${list.length === 1 ? "" : "s"} in your workspace`}
          </p>
        </div>

        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Incoming invitations (accept / decline) */}
      <InvitationsBanner onChanged={fetchProjects} />

      {/* Action errors (archive/restore/delete failures) */}
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

      {/* Search + filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search projects…"
            aria-label="Search projects"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 transition-all focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                filter === key
                  ? "bg-brand-600 text-white shadow-soft"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700"
              )}
            >
              {label}
              {!loading && projects && countFor(key) > 0 ? (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    filter === key
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-500"
                  )}
                >
                  {countFor(key)}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-panel border border-slate-200/70 bg-surface p-6 shadow-soft"
            >
              <div className="flex items-start justify-between">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <Skeleton className="h-6 w-6 rounded-md" />
              </div>
              <Skeleton className="mt-4 h-5 w-2/3" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-1.5 h-4 w-4/5" />
              <Skeleton className="mt-5 h-2 w-full rounded-full" />
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="flex gap-1.5">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <Skeleton className="h-7 w-7 rounded-full" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
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
            <h3 className="text-lg font-bold text-slate-900">
              Couldn’t load projects
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {error?.response?.data?.message ||
                "Check that the API is running and try again."}
            </p>
            <Button onClick={fetchProjects} className="mt-5">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        </div>
      ) : null}

      {/* Empty — no projects at all */}
      {projects && list.length === 0 && !error ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to start tracking tasks and deadlines."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          }
          className="py-16"
        />
      ) : null}

      {/* Empty — search/filter matched nothing */}
      {projects && list.length > 0 && visible.length === 0 && !error ? (
        <EmptyState
          icon={Search}
          title={search ? `No projects match “${search}”` : `No ${statusOf(filter).label.toLowerCase()} projects`}
          description="Try a different search term or filter."
          action={
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setFilter("all");
              }}
            >
              Clear search & filters
            </Button>
          }
          className="py-16"
        />
      ) : null}

      {/* Project cards */}
      {!loading && visible.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((project, index) => {
            const color = projectColor(project.color);
            const status = statusOf(project.status);

            return (
              <article
                key={project.id}
                style={{ animationDelay: `${index * 60}ms` }}
                onClick={() => navigate(`/projects/${project.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") navigate(`/projects/${project.id}`);
                }}
                role="link"
                tabIndex={0}
                aria-label={`Open ${project.name}`}
                className="group animate-slide-up cursor-pointer rounded-panel border border-slate-200/70 bg-surface p-6 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20"
              >
                <div className="flex items-start justify-between">
                  <span
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-soft",
                      color.icon
                    )}
                  >
                    <FolderKanban className="h-5 w-5" />
                  </span>

                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                        status.className
                      )}
                    >
                      {status.label}
                    </span>
                    <ProjectActionsMenu
                      project={project}
                      myRole={project.myRole}
                      onEdit={() => openEdit(project)}
                      onArchive={() => handleArchive(project)}
                      onRestore={() => handleRestore(project)}
                      onDelete={() => setDeleteTarget(project)}
                    />
                  </div>
                </div>

                <h3 className="mt-4 truncate text-base font-bold text-slate-900">
                  {project.name}
                </h3>
                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-slate-500">
                  {project.description || "No description yet."}
                </p>

                {/* Progress */}
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-500">
                      {project.doneTasks}/{project.totalTasks} tasks
                    </span>
                    <span className="font-bold tabular-nums text-slate-700">
                      {project.progress}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn(
                        "h-full rounded-full bg-gradient-to-r transition-all duration-700",
                        color.gradient
                      )}
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <div className="-space-x-2">
                    {project.members.slice(0, 4).map((member) => (
                      <span
                        key={member.id}
                        title={`${member.name || "Member"} · ${member.role}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold text-slate-600"
                      >
                        {initialsOf(member.name)}
                      </span>
                    ))}
                    {project.members.length > 4 ? (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-brand-50 text-[10px] font-bold text-brand-600">
                        +{project.members.length - 4}
                      </span>
                    ) : null}
                    {project.members.length === 0 ? (
                      <span className="text-[11px] text-slate-400">
                        No members yet
                      </span>
                    ) : null}
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {project.dueDate ? formatDate(project.dueDate) : "No due date"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {/* Create / edit dialog */}
      <ProjectFormModal
        open={formOpen}
        project={editing}
        onClose={() => setFormOpen(false)}
        onSaved={fetchProjects}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete project"
        message={
          deleteTarget
            ? `“${deleteTarget.name}” and all of its tasks, activity, and invitations will be permanently deleted. This can’t be undone.`
            : ""
        }
        confirmLabel="Delete project"
      />
    </div>
  );
}
