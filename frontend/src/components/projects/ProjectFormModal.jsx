import { useEffect, useState } from "react";

import Modal from "../ui/Modal.jsx";
import Button from "../ui/Button.jsx";
import Alert from "../ui/Alert.jsx";
import { createProject, updateProject } from "../../api/projects.js";
import { PROJECT_COLORS, projectColor } from "../../utils/projectColors.js";
import { cn } from "../../utils/cn.js";

const EMPTY = { name: "", description: "", color: "indigo", dueDate: "" };

const toInputDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const validate = (form) => {
  const errors = {};
  const name = form.name.trim();
  if (name.length < 2) errors.name = "Project name must be at least 2 characters";
  else if (name.length > 100) errors.name = "Project name must be 100 characters or fewer";
  if (form.description.length > 500)
    errors.description = "Description must be 500 characters or fewer";
  return errors;
};

/**
 * Create / edit project dialog (name, description, color, due date).
 * Pass `project` to edit, `null`/undefined to create.
 */
export default function ProjectFormModal({ open, project, onClose, onSaved }) {
  const isEdit = Boolean(project);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Reset the form whenever the dialog opens
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setServerError(null);
    setForm(
      project
        ? {
            name: project.name ?? "",
            description: project.description ?? "",
            color: project.color ?? "indigo",
            dueDate: toInputDate(project.dueDate),
          }
        : EMPTY
    );
  }, [open, project]);

  const set = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    setServerError(null);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      color: form.color,
      dueDate: form.dueDate ? `${form.dueDate}T12:00:00` : null,
    };

    setSaving(true);
    try {
      const data = isEdit
        ? await updateProject(project.id, payload)
        : await createProject(payload);
      onSaved?.(data.project);
      onClose();
    } catch (error) {
      setServerError(
        error.response?.data?.message ||
          error.response?.data?.errors?.name ||
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
      title={isEdit ? "Edit project" : "New project"}
      description={
        isEdit
          ? "Update the project details."
          : "Give your project a name — you can invite the team next."
      }
      closeOnBackdrop={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="project-form" loading={saving}>
            {isEdit ? "Save changes" : "Create project"}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={handleSubmit} className="space-y-4">
        {serverError ? <Alert variant="error">{serverError}</Alert> : null}

        {/* Name */}
        <div>
          <label
            htmlFor="project-name"
            className="mb-1.5 block text-sm font-semibold text-slate-700"
          >
            Project name <span className="ml-0.5 text-rose-500">*</span>
          </label>
          <input
            id="project-name"
            type="text"
            value={form.name}
            onChange={set("name")}
            placeholder="e.g. Website Redesign"
            maxLength={100}
            autoFocus
            aria-invalid={Boolean(errors.name)}
            className={cn(
              "w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-4",
              errors.name
                ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/10"
                : "border-slate-200 focus:border-brand-300 focus:ring-brand-500/10"
            )}
          />
          {errors.name ? (
            <p className="mt-1.5 text-xs font-medium text-rose-600">{errors.name}</p>
          ) : null}
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="project-description"
            className="mb-1.5 block text-sm font-semibold text-slate-700"
          >
            Description
          </label>
          <textarea
            id="project-description"
            value={form.description}
            onChange={set("description")}
            rows={3}
            maxLength={500}
            placeholder="What is this project about?"
            className={cn(
              "w-full resize-none rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:bg-white focus:outline-none focus:ring-4",
              errors.description
                ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/10"
                : "border-slate-200 focus:border-brand-300 focus:ring-brand-500/10"
            )}
          />
          <div className="mt-1 flex items-center justify-between">
            {errors.description ? (
              <p className="text-xs font-medium text-rose-600">
                {errors.description}
              </p>
            ) : (
              <span />
            )}
            <span className="text-[11px] tabular-nums text-slate-400">
              {form.description.length}/500
            </span>
          </div>
        </div>

        {/* Color */}
        <fieldset>
          <legend className="mb-1.5 block text-sm font-semibold text-slate-700">
            Color
          </legend>
          <div className="flex flex-wrap gap-2">
            {Object.keys(PROJECT_COLORS).map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, color }))}
                aria-label={`Choose ${color}`}
                aria-pressed={form.color === color}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-all",
                  form.color === color
                    ? "border-brand-300 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                )}
              >
                <span
                  className={cn("h-2.5 w-2.5 rounded-full", projectColor(color).dot)}
                />
                {color}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Due date */}
        <div>
          <label
            htmlFor="project-due"
            className="mb-1.5 block text-sm font-semibold text-slate-700"
          >
            Due date
          </label>
          <input
            id="project-due"
            type="date"
            value={form.dueDate}
            onChange={set("dueDate")}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition-all focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
          />
        </div>
      </form>
    </Modal>
  );
}
