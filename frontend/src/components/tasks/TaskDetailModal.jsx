import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  FolderKanban,
  Link2,
  ListChecks,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import Modal from "../ui/Modal.jsx";
import Button from "../ui/Button.jsx";
import Alert from "../ui/Alert.jsx";
import CommentsThread from "./CommentsThread.jsx";
import ActivityTimeline from "./ActivityTimeline.jsx";
import {
  addAttachment,
  addSubtask,
  removeAttachment,
  removeSubtask,
  setTaskStatus,
  updateSubtask,
  updateTask,
  uploadAttachment,
} from "../../api/tasks.js";
import { TASK_PRIORITY, TASK_STATUS, DUE_TONES } from "../../utils/projectColors.js";
import { dueLabel, initialsOf } from "../../utils/dates.js";
import {
  canEditTasks,
  canUpdateTaskProgress,
} from "../../utils/permissions.js";
import { cn } from "../../utils/cn.js";

const SELECT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition-all focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10";

const toInputDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Task detail dialog: full field view with inline editing (status, priority,
 * assignee, dates), subtask add/complete/remove, link attachments, and
 * permission-aware edit/delete actions.
 *
 * Every mutation calls `onChanged()` so the parent silently refreshes the
 * list (the task prop then updates in place).
 */
export default function TaskDetailModal({
  open,
  task,
  projects,
  user,
  onClose,
  onEdit,
  onDelete,
  onChanged,
}) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [subDraft, setSubDraft] = useState("");
  const [attUrl, setAttUrl] = useState("");
  const [attName, setAttName] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activityKey, setActivityKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSubDraft("");
    setAttUrl("");
    setAttName("");
    setFile(null);
    setActivityKey((prev) => prev + 1);
  }, [open, task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const members = useMemo(() => {
    if (!task?.project?.id) return [];
    return (projects || []).find((p) => p.id === task.project.id)?.members || [];
  }, [task, projects]);

  if (!open || !task) return null;

  const canEdit = canEditTasks(task.myRole);
  const canProgress = canUpdateTaskProgress(task.myRole, task, user?.id);
  // Same rule as the server: editors+ OR the task's assignee can attach.
  const canAttach =
    canEdit || (Boolean(task.assignee) && task.assignee.id === user?.id);
  const priority = TASK_PRIORITY[task.priority] ?? TASK_PRIORITY.medium;
  const status = TASK_STATUS[task.status] ?? TASK_STATUS.todo;
  const due = dueLabel(task.dueDate);
  const isDone = task.status === "done";
  const subs = task.subtaskProgress || { total: 0, completed: 0 };

  /** Run a mutation, surface its error locally, refresh the parent list. */
  const run = async (fn) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await onChanged?.();
      setActivityKey((prev) => prev + 1); // refresh the history timeline
      return true;
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.errors?.[0]?.msg ||
          "Something went wrong. Please try again."
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveFields = (payload) => run(() => updateTask(task.id, payload));

  const changeStatus = (statusValue) =>
    run(() => setTaskStatus(task.id, statusValue));

  const changeDates = (startDate, dueDate) =>
    run(() =>
      updateTask(task.id, {
        startDate: startDate ? `${startDate}T12:00:00` : null,
        dueDate: dueDate ? `${dueDate}T12:00:00` : null,
      })
    );

  const submitSubtask = async (event) => {
    event.preventDefault();
    const title = subDraft.trim();
    if (title.length < 2) return;
    const saved = await run(() => addSubtask(task.id, title));
    if (saved) setSubDraft("");
  };

  const submitAttachment = async (event) => {
    event.preventDefault();
    if (!attUrl.trim()) return;
    const saved = await run(() =>
      addAttachment(task.id, {
        url: attUrl.trim(),
        name: attName.trim() || undefined,
      })
    );
    if (saved) {
      setAttUrl("");
      setAttName("");
    }
  };

  /** Multipart upload — file chosen through the paperclip input. */
  const handleUpload = async (event) => {
    const chosen = event.target.files?.[0] ?? null;
    event.target.value = ""; // allow re-picking the same file
    if (!chosen) return;
    if (chosen.size > 8 * 1024 * 1024) {
      setError("That file is larger than 8 MB.");
      return;
    }
    setFile(chosen);
    setUploading(true);
    await run(() => uploadAttachment(task.id, chosen));
    setUploading(false);
    setFile(null);
  };

  /** View object handed to the discussion (adds the refresh hook). */
  const taskView = { ...task, refresh: onChanged };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task.title}
      description={
        task.project
          ? `${task.project.name} · created by ${task.createdBy?.name ?? "someone"}`
          : undefined
      }
      size="lg"
      footer={
        <>
          {canEdit ? (
            <Button variant="ghost" onClick={() => onDelete(task)} disabled={busy}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Close
          </Button>
          {canEdit ? (
            <Button onClick={() => onEdit(task)} disabled={busy}>
              <Pencil className="h-4 w-4" />
              Edit task
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-5">
        {error ? <Alert variant="error">{error}</Alert> : null}

        {/* Labels + description */}
        {(task.labels || []).length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {task.labels.map((label) => (
              <span
                key={label}
                className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-600"
              >
                #{label}
              </span>
            ))}
          </div>
        ) : null}

        {task.description ? (
          <p className="whitespace-pre-line text-sm leading-6 text-slate-600">
            {task.description}
          </p>
        ) : (
          <p className="text-sm italic text-slate-400">No description.</p>
        )}

        {/* Inline field editors */}
        <div className="grid grid-cols-1 gap-4 rounded-panel border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2">
          {/* Status */}
          <div>
            <label
              htmlFor="detail-status"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Status
            </label>
            <select
              id="detail-status"
              value={task.status}
              disabled={!canProgress || busy}
              onChange={(event) => changeStatus(event.target.value)}
              className={cn(SELECT_CLASS, "disabled:cursor-not-allowed disabled:opacity-60")}
            >
              {Object.entries(TASK_STATUS).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            {!canProgress ? (
              <p className="mt-1 text-[11px] text-slate-400">
                Only editors or the assignee can update progress.
              </p>
            ) : null}
          </div>

          {/* Priority */}
          <div>
            <label
              htmlFor="detail-priority"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Priority
            </label>
            <select
              id="detail-priority"
              value={task.priority}
              disabled={!canEdit || busy}
              onChange={(event) => saveFields({ priority: event.target.value })}
              className={cn(SELECT_CLASS, "disabled:cursor-not-allowed disabled:opacity-60")}
            >
              {Object.entries(TASK_PRIORITY).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Assignee */}
          <div>
            <label
              htmlFor="detail-assignee"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Assignee
            </label>
            <select
              id="detail-assignee"
              value={task.assignee?.id ?? ""}
              disabled={!canEdit || busy}
              onChange={(event) => saveFields({ assignee: event.target.value || null })}
              className={cn(SELECT_CLASS, "disabled:cursor-not-allowed disabled:opacity-60")}
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="detail-start"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Start
              </label>
              <input
                id="detail-start"
                type="date"
                value={toInputDate(task.startDate)}
                disabled={!canEdit || busy}
                onChange={(event) =>
                  changeDates(event.target.value, toInputDate(task.dueDate))
                }
                className={cn(SELECT_CLASS, "disabled:cursor-not-allowed disabled:opacity-60")}
              />
            </div>
            <div>
              <label
                htmlFor="detail-due"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Due
              </label>
              <input
                id="detail-due"
                type="date"
                value={toInputDate(task.dueDate)}
                disabled={!canEdit || busy}
                onChange={(event) =>
                  changeDates(toInputDate(task.startDate), event.target.value)
                }
                className={cn(SELECT_CLASS, "disabled:cursor-not-allowed disabled:opacity-60")}
              />
            </div>
          </div>
        </div>

        {/* Status / priority / due summary chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 font-semibold uppercase tracking-wide",
              status.className
            )}
          >
            {status.label}
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 font-semibold uppercase tracking-wide",
              priority.className
            )}
          >
            {priority.label}
          </span>
          {due ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold",
                DUE_TONES[due.tone]
              )}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {due.text}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-500">
              <CalendarClock className="h-3.5 w-3.5" />
              No due date
            </span>
          )}
          {task.startDate ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-500">
              <CalendarClock className="h-3.5 w-3.5" />
              Starts {new Date(task.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          ) : null}
          <span
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-500"
            title={`In ${task.project?.name ?? "project"}`}
          >
            <FolderKanban className="h-3.5 w-3.5" />
            {task.project?.name}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-500">
            {task.assignee ? (
              <>
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-[8px] font-bold text-white">
                  {initialsOf(task.assignee.name)}
                </span>
                {task.assignee.name}
              </>
            ) : (
              <>
                <UserRound className="h-3.5 w-3.5" />
                Unassigned
              </>
            )}
          </span>
        </div>

        {/* Subtasks */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-800">
              <ListChecks className="h-4 w-4 text-brand-500" />
              Subtasks
              {subs.total > 0 ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">
                  {subs.completed}/{subs.total}
                </span>
              ) : null}
            </h3>
            {subs.total > 0 ? (
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-500"
                  style={{
                    width: `${Math.round((subs.completed / subs.total) * 100)}%`,
                  }}
                />
              </div>
            ) : null}
          </div>

          {subs.total > 0 ? (
            <ul className="mb-2 space-y-1">
              {task.subtasks.map((sub) => (
                <li
                  key={sub.id}
                  className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50"
                >
                  <button
                    type="button"
                    disabled={!canProgress || busy}
                    onClick={() =>
                      run(() =>
                        updateSubtask(task.id, sub.id, { completed: !sub.completed })
                      )
                    }
                    aria-label={
                      sub.completed ? `Reopen ${sub.title}` : `Complete ${sub.title}`
                    }
                    className={cn(
                      "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-2 transition-all",
                      sub.completed
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 bg-white hover:border-brand-400",
                      !canProgress && "cursor-not-allowed opacity-60"
                    )}
                  >
                    {sub.completed ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </button>
                  <span
                    className={cn(
                      "flex-1 text-sm",
                      sub.completed ? "text-slate-400 line-through" : "text-slate-700"
                    )}
                  >
                    {sub.title}
                  </span>
                  {canProgress ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => removeSubtask(task.id, sub.id))}
                      aria-label={`Remove subtask ${sub.title}`}
                      className="rounded-md p-1 text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2 text-xs text-slate-400">No subtasks yet.</p>
          )}

          {canProgress ? (
            <form onSubmit={submitSubtask} className="flex gap-2">
              <input
                type="text"
                value={subDraft}
                onChange={(event) => setSubDraft(event.target.value)}
                placeholder="Add a subtask…"
                maxLength={100}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 transition-all focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
              />
              <Button
                type="submit"
                variant="ghost"
                disabled={busy || subDraft.trim().length < 2}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </form>
          ) : null}
        </section>

        {/* Attachments */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-800">
              <Link2 className="h-4 w-4 text-brand-500" />
              Attachments
              {(task.attachments || []).length > 0 ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">
                  {task.attachments.length}
                </span>
              ) : null}
            </h3>

            {/* File upload (paperclip) — editors+ and the assignee */}
            {canAttach ? (
              <>
                <label
                  htmlFor="detail-file"
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
                    "border border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700"
                  )}
                  title="Upload a file (max 8 MB)"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {uploading && file
                    ? `Uploading ${file.name}…`
                    : "Upload file"}
                </label>
                <input
                  id="detail-file"
                  type="file"
                  className="hidden"
                  disabled={busy || uploading}
                  onChange={handleUpload}
                />
              </>
            ) : null}
          </div>

          {(task.attachments || []).length > 0 ? (
            <ul className="mb-2 space-y-1">
              {task.attachments.map((att) => {
                const isUpload = att.url?.startsWith("/uploads/");
                let label = att.name || att.url;
                let host = "";
                if (isUpload) {
                  label = att.name || "Uploaded file";
                } else {
                  try {
                    host = new URL(att.url).hostname.replace(/^www\./, "");
                  } catch {
                    /* keep raw url */
                  }
                  if (!att.name) label = host;
                }
                const sizeHint = att.size
                  ? `${(att.size / 1024).toFixed(0)} KB`
                  : "";
                return (
                  <li
                    key={att.id}
                    className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50"
                  >
                    <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      download={!isUpload ? undefined : ""}
                      className="min-w-0 flex-1 truncate text-sm font-medium text-brand-600 hover:underline"
                      title={att.name || att.url}
                    >
                      {label}
                    </a>
                    {sizeHint ? (
                      <span className="hidden text-[11px] text-slate-400 sm:inline">
                        {sizeHint}
                      </span>
                    ) : null}
                    <span className="hidden truncate text-[11px] text-slate-400 sm:block">
                      {isUpload ? att.type || "file" : host}
                    </span>
                    {canEdit ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => removeAttachment(task.id, att.id))}
                        aria-label={`Remove attachment ${att.name || host}`}
                        className="rounded-md p-1 text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mb-2 text-xs text-slate-400">
              No attachments yet — link a URL or upload a file above.
            </p>
          )}

          {canAttach ? (
            <form onSubmit={submitAttachment} className="flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                value={attUrl}
                onChange={(event) => setAttUrl(event.target.value)}
                placeholder="https://example.com/spec.pdf"
                required
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 transition-all focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
              />
              <input
                type="text"
                value={attName}
                onChange={(event) => setAttName(event.target.value)}
                placeholder="Name (optional)"
                maxLength={100}
                className="sm:w-40 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 transition-all focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
              />
              <Button type="submit" variant="ghost" disabled={busy || !attUrl.trim()}>
                <Plus className="h-4 w-4" />
                Attach
              </Button>
            </form>
          ) : null}
        </section>
        {/* Discussion (threaded comments) + activity history */}
        <CommentsThread task={taskView} user={user} />
        <ActivityTimeline taskId={task.id} refreshKey={activityKey} />
      </div>
    </Modal>
  );
}
