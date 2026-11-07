/**
 * Shared color tokens for projects (mirrors the backend enum).
 * Each entry provides: dot (solid), gradient (bars/icons), badge (chips).
 */
export const PROJECT_COLORS = {
  indigo: {
    dot: "bg-brand-500",
    gradient: "from-brand-500 to-brand-600",
    icon: "from-brand-500 to-brand-600",
    text: "text-brand-600",
  },
  blue: {
    dot: "bg-accent-500",
    gradient: "from-accent-500 to-accent-600",
    icon: "from-accent-500 to-accent-600",
    text: "text-accent-600",
  },
  emerald: {
    dot: "bg-emerald-500",
    gradient: "from-emerald-500 to-teal-500",
    icon: "from-emerald-500 to-teal-500",
    text: "text-emerald-600",
  },
  amber: {
    dot: "bg-amber-500",
    gradient: "from-amber-500 to-orange-500",
    icon: "from-amber-500 to-orange-500",
    text: "text-amber-600",
  },
  rose: {
    dot: "bg-rose-500",
    gradient: "from-rose-500 to-pink-500",
    icon: "from-rose-500 to-pink-500",
    text: "text-rose-600",
  },
  sky: {
    dot: "bg-sky-500",
    gradient: "from-sky-500 to-cyan-500",
    icon: "from-sky-500 to-cyan-500",
    text: "text-sky-600",
  },
};

export const PROJECT_STATUS = {
  active: { label: "Active", className: "bg-emerald-50 text-emerald-600" },
  "on-hold": { label: "On hold", className: "bg-amber-50 text-amber-600" },
  completed: { label: "Completed", className: "bg-accent-50 text-accent-600" },
  archived: { label: "Archived", className: "bg-slate-100 text-slate-500" },
};

export const TASK_PRIORITY = {
  low: { label: "Low", className: "bg-slate-100 text-slate-500" },
  medium: { label: "Medium", className: "bg-accent-50 text-accent-600" },
  high: { label: "High", className: "bg-amber-50 text-amber-600" },
  urgent: { label: "Urgent", className: "bg-rose-50 text-rose-600" },
};

export const TASK_STATUS = {
  todo: { label: "To do", className: "bg-slate-100 text-slate-600" },
  "in-progress": { label: "In progress", className: "bg-brand-50 text-brand-600" },
  "in-review": { label: "In review", className: "bg-violet-50 text-violet-600" },
  done: { label: "Done", className: "bg-emerald-50 text-emerald-600" },
};

/** Due-date chip tones (overdue/today = rose, soon = amber, later = slate). */
export const DUE_TONES = {
  rose: "bg-rose-50 text-rose-600",
  amber: "bg-amber-50 text-amber-600",
  slate: "bg-slate-100 text-slate-500",
};

/** Colors used by the task-status donut (hex for SVG strokes). */
export const STATUS_HEX = {
  done: "#10b981",
  "in-progress": "#6366f1",
  "in-review": "#8b5cf6",
  todo: "#cbd5e1",
};

export const projectColor = (name) => PROJECT_COLORS[name] || PROJECT_COLORS.indigo;
