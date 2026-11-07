import { useEffect, useMemo, useState } from "react";

import Modal from "../ui/Modal.jsx";
import Button from "../ui/Button.jsx";
import Alert from "../ui/Alert.jsx";
import { Plus, X } from "lucide-react";
import { createTask, updateTask, setTaskStatus } from "../../api/tasks.js";
import { TASK_PRIORITY, TASK_STATUS } from "../../utils/projectColors.js";
import { cn } from "../../utils/cn.js";

const EMPTY = {
  projectId: "",
  title: "",
  description: "",
  priority: "medium",
  status: "todo",
  assignee: "",
  startDate: "",
  dueDate: "",
  labels: [],
};

const toInputDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const validate = (form) => {
  const errors = {};
  const title = form.title.trim();
  if (title.length < 2) errors.title = "Title must be at least 2 characters";
  else if (title.length > 200) errors.title = "Title must be 200 characters or fewer";
  if (form.description.length > 1000)
    errors.description = "Description must be 1000 characters or fewer";
  if (form.startDate && form.dueDate && form.startDate > form.dueDate)
    errors.dueDate = "Due date can’t be before the start date";
  if (form.labels.length > 10) errors.labels = "At most 10 labels";
  if (form.labels.some((label) => label.length > 24))
    errors.labels = "Labels must be 24 characters or fewer";
  return errors;
};

const inputClass = (hasError) =>
  cn(
    "w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-4",
    hasError
      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/10"
      : "border-slate-200 focus:border-brand-300 focus:ring-brand-500/10"
  );

/**
 * Create / edit task dialog — every task field:
 * project, title, description, assignee (project members only),
 * priority, status, start/due dates, labels.
 * Pass `task` to edit, `null` to create.
 */
export default function TaskFormModal({ open, task, projects, onClose, onSaved, defaults }) {
  const isEdit = Boolean(task);
  const [form, setForm] = useState(EMPTY);
  const [labelDraft, setLabelDraft] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);

  const visibleProjects = useMemo(
    () => (projects || []).filter((p) => p.status !== "archived" || p.id === task?.project?.id),
    [projects, task]
  );

  // Assignee options: members of the form's project
  const members = useMemo(() => {
    const projectId = form.projectId;
    if (!projectId) return [];
    return (visibleProjects.find((p) => p.id === projectId)?.members || []).map(
      (m) => ({ id: m.id, name: m.name, email: m.email })
    );
  }, [form.projectId, visibleProjects]);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setServerError(null);
    setLabelDraft("");
    if (task) {
      setForm({
        projectId: task.project?.id ?? "",
        title: task.title ?? "",
        description: task.description ?? "",
        priority: task.priority ?? "medium",
        status: task.status ?? "todo",
        assignee: task.assignee?.id ?? "",
        startDate: toInputDate(task.startDate),
        dueDate: toInputDate(task.dueDate),
        labels: [...(task.labels || [])],
      });
    } else {
      const defaultProject =
        defaults?.projectId ||
        visibleProjects.find((p) => p.status !== "archived")?.id ||
        "";
      setForm({
        ...EMPTY,
        projectId: defaultProject,
        status: defaults?.status || EMPTY.status,
      });
    }
  }, [open, task]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const addLabel = () => {
    const label = labelDraft.trim().toLowerCase().replace(/^#/, "");
    if (!label) return;
    setForm((prev) =>
      prev.labels.includes(label) || prev.labels.length >= 10
        ? prev
        : { ...prev, labels: [...prev.labels, label] }
    );
    setLabelDraft("");
  };

  const removeLabel = (label) =>
    setForm((prev) => ({ ...prev, labels: prev.labels.filter((l) => l !== label) }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    setServerError(null);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      assignee: form.assignee || null,
      startDate: form.startDate ? `${form.startDate}T12:00:00` : null,
      dueDate: form.dueDate ? `${form.dueDate}T12:00:00` : null,
      labels: form.labels,
    };

    setSaving(true);
    try {
      let saved;
      if (isEdit) {
        saved = await updateTask(task.id, payload).then((d) => d.task);
        // Status lives behind its own endpoint
        if (form.status !== task.status) {
          saved = await setTaskStatus(task.id, form.status).then((d) => d.task);
        }
      } else {
        saved = await createTask({
          ...payload,
          projectId: form.projectId,
          status: form.status,
        }).then((d) => d.task);
      }
      onSaved?.(saved);
      onClose();
    } catch (error) {
      setServerError(
        error.response?.data?.message ||
          error.response?.data?.errors?.[0]?.msg ||
          "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={isEdit ? "Edit task" : "New task"}
      description={
        isEdit
          ? "Update the task details."
          : "Add a task to a project and assign it to a teammate."
      }
      size="lg"
      closeOnBackdrop={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="task-form" loading={saving}>
            {isEdit ? "Save changes" : "Create task"}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} className="space-y-4">
        {serverError ? <Alert variant="error">{serverError}</Alert> : null}

        {/* Project (create only — tasks can't move projects) */}
        <div>
          <label
            htmlFor="task-project"
            className="mb-1.5 block text-sm font-semibold text-slate-700"
          >
            Project <span className="ml-0.5 text-rose-500">*</span>
          </label>
          <select
            id="task-project"
            value={form.projectId}
            onChange={set("projectId")}
            disabled={isEdit || visibleProjects.length === 0}
            className={cn(inputClass(errors.projectId), "disabled:opacity-60")}
          >
            {visibleProjects.length === 0 ? (
              <option value="">Create a project first</option>
            ) : (
              visibleProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))
            )}
          </select>
          {errors.projectId ? (
            <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.projectId}</p>
          ) : null}
        </div>

        {/* Title */}
        <div>
          <label
            htmlFor="task-title"
            className="mb-1.5 block text-sm font-semibold text-slate-700"
          >
            Title <span className="ml-0.5 text-rose-500">*</span>
          </label>
          <input
            id="task-title"
            type="text"
            value={form.title}
            onChange={set("title")}
            placeholder="e.g. Implement pricing page"
            maxLength={200}
            autoFocus
            aria-invalid={Boolean(errors.title)}
            className={inputClass(errors.title)}
          />
          {errors.title ? (
            <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.title}</p>
          ) : null}
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="task-description"
            className="mb-1.5 block text-sm font-semibold text-slate-700"
          >
            Description
          </label>
          <textarea
            id="task-description"
            value={form.description}
            onChange={set("description")}
            rows={3}
            maxLength={1000}
            placeholder="What needs to happen?"
            className={cn(inputClass(errors.description), "resize-none")}
          />
          <div className="mt-1 flex items-center justify-between">
            {errors.description ? (
              <p className="text-xs font-medium text-rose-600">{errors.description}</p>
            ) : (
              <span />
            )}
            <span className="text-[11px] tabular-nums text-slate-400">
              {form.description.length}/1000
            </span>
          </div>
        </div>

        {/* Priority / status / assignee */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="task-priority"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Priority
            </label>
            <select
              id="task-priority"
              value={form.priority}
              onChange={set("priority")}
              className={inputClass(false)}
            >
              {Object.entries(TASK_PRIORITY).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="task-status"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Status
            </label>
            <select
              id="task-status"
              value={form.status}
              onChange={set("status")}
              className={inputClass(false)}
            >
              {Object.entries(TASK_STATUS).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="task-assignee"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Assignee
            </label>
            <select
              id="task-assignee"
              value={form.assignee}
              onChange={set("assignee")}
              className={inputClass(false)}
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="task-start"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Start date
            </label>
            <input
              id="task-start"
              type="date"
              value={form.startDate}
              onChange={set("startDate")}
              className={inputClass(false)}
            />
          </div>
          <div>
            <label
              htmlFor="task-due"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Due date
            </label>
            <input
              id="task-due"
              type="date"
              value={form.dueDate}
              onChange={set("dueDate")}
              aria-invalid={Boolean(errors.dueDate)}
              className={inputClass(errors.dueDate)}
            />
            {errors.dueDate ? (
              <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.dueDate}</p>
            ) : null}
          </div>
        </div>

        {/* Labels */}
        <fieldset>
          <legend className="mb-1.5 block text-sm font-semibold text-slate-700">
            Labels
          </legend>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
            {form.labels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700"
              >
                #{label}
                <button
                  type="button"
                  onClick={() => removeLabel(label)}
                  aria-label={`Remove label ${label}`}
                  className="rounded-full p-0.5 text-brand-500 transition-colors hover:bg-brand-200 hover:text-brand-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={labelDraft}
              onChange={(event) => setLabelDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addLabel();
                }
              }}
              onBlur={addLabel}
              placeholder={form.labels.length >= 10 ? "Label limit reached" : "Add label + Enter"}
              disabled={form.labels.length >= 10}
              maxLength={24}
              className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={addLabel}
              disabled={!labelDraft.trim() || form.labels.length >= 10}
              aria-label="Add label"
              className="rounded-lg bg-white p-1.5 text-slate-500 shadow-sm ring-1 ring-slate-200 transition-all hover:text-brand-600 hover:ring-brand-300 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {errors.labels ? (
            <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.labels}</p>
          ) : (
            <p className="mt-1.5 text-[11px] text-slate-400">
              Lowercase tags for grouping — press Enter to add. Max 10 labels.
            </p>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}
