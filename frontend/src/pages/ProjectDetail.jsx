import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  CircleAlert,
  FolderKanban,
  RefreshCw,
} from "lucide-react";

import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import ProjectFormModal from "../components/projects/ProjectFormModal.jsx";
import ProjectActionsMenu from "../components/projects/ProjectActionsMenu.jsx";
import MembersCard from "../components/projects/MembersCard.jsx";
import InvitationsCard from "../components/projects/InvitationsCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  archiveProject,
  deleteProject,
  getProject,
  restoreProject,
} from "../api/projects.js";
import { PROJECT_STATUS, projectColor } from "../utils/projectColors.js";
import { formatDate, relativeTime } from "../utils/dates.js";
import { ROLE_LABELS, canManageSettings } from "../utils/permissions.js";
import { cn } from "../utils/cn.js";

/**
 * Project detail: overview + progress, member management (roles, removal),
 * invitations (invite by email), and owner-only settings actions.
 */
export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // { status, message }
  const [actionError, setActionError] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchProject = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProject(id);
      setProject(data.project);
    } catch (err) {
      setError({
        status: err.response?.status,
        message:
          err.response?.data?.message ||
          "Couldn’t load this project. Please try again.",
      });
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const runAction = async (fn) => {
    setActionError(null);
    try {
      await fn();
      await fetchProject();
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Something went wrong. Please try again."
      );
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setActionError(null);
    try {
      await deleteProject(id);
      navigate("/projects", { replace: true });
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Couldn’t delete the project."
      );
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  // ---------- loading ----------
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-40" />
        <div className="rounded-panel border border-slate-200/70 bg-surface p-6 shadow-soft">
          <div className="flex items-start gap-4">
            <Skeleton className="h-14 w-14 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-7 w-64 max-w-full" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
          <Skeleton className="mt-6 h-3 w-full rounded-full" />
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-panel" />
          <Skeleton className="h-72 rounded-panel" />
        </div>
      </div>
    );
  }

  // ---------- error (404 = not found OR not a member) ----------
  if (error) {
    const isMissing = error.status === 404;
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md rounded-panel border border-slate-200/70 bg-surface p-8 text-center shadow-soft">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
            <CircleAlert className="h-6 w-6" />
          </span>
          <h2 className="text-lg font-bold text-slate-900">
            {isMissing ? "Project not found" : "Couldn’t load this project"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {isMissing
              ? "This project doesn’t exist, or you don’t have access to it."
              : error.message}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/projects")}>
              <ArrowLeft className="h-4 w-4" />
              Back to projects
            </Button>
            {!isMissing ? (
              <Button onClick={fetchProject}>
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (!project) return null;

  const color = projectColor(project.color);
  const status = PROJECT_STATUS[project.status] ?? PROJECT_STATUS.active;
  const isOwner = canManageSettings(project.myRole);
  const isArchived = project.status === "archived";

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" />
        All projects
      </Link>

      {actionError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      ) : null}

      {/* Header */}
      <section className="rounded-panel border border-slate-200/70 bg-surface p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span
              className={cn(
                "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-soft",
                color.icon
              )}
            >
              <FolderKanban className="h-7 w-7" />
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="truncate text-2xl font-bold tracking-tight text-slate-900">
                  {project.name}
                </h2>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                    status.className
                  )}
                >
                  {status.label}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  {ROLE_LABELS[project.myRole] ?? "Member"}
                </span>
              </div>

              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
                {project.description || "No description yet."}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {project.dueDate
                    ? `Due ${formatDate(project.dueDate, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}`
                    : "No due date"}
                </span>
                <span>Created {relativeTime(project.createdAt)}</span>
                {project.owner?.name ? (
                  <span>Owned by {project.owner.name}</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isOwner && !isArchived ? (
              <Button variant="ghost" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
            ) : null}
            <ProjectActionsMenu
              project={project}
              myRole={project.myRole}
              onEdit={() => setEditOpen(true)}
              onArchive={() => runAction(() => archiveProject(project.id))}
              onRestore={() => runAction(() => restoreProject(project.id))}
              onDelete={() => setDeleteOpen(true)}
            />
          </div>
        </div>

        {/* Progress */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-600">
              {project.doneTasks} of {project.totalTasks} tasks completed
            </span>
            <span className="font-bold tabular-nums text-slate-900">
              {project.progress}%
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r transition-all duration-700",
                color.gradient
              )}
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <p className="text-xs font-medium text-slate-500">Total tasks</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">
              {project.totalTasks}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <p className="text-xs font-medium text-slate-500">Completed</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-600">
              {project.doneTasks}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <p className="text-xs font-medium text-slate-500">Remaining</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">
              {project.totalTasks - project.doneTasks}
            </p>
          </div>
        </div>
      </section>

      {/* Members + invitations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MembersCard
          project={project}
          currentUserId={user?.id}
          onChanged={fetchProject}
        />
        <InvitationsCard project={project} onChanged={fetchProject} />
      </div>

      {/* Edit dialog */}
      <ProjectFormModal
        open={editOpen}
        project={project}
        onClose={() => setEditOpen(false)}
        onSaved={fetchProject}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete project"
        message={`“${project.name}” and all of its tasks, activity, and invitations will be permanently deleted. This can’t be undone.`}
        confirmLabel="Delete project"
      />
    </div>
  );
}
