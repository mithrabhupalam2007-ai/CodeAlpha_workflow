import { ArrowDown, ArrowUp, Search } from "lucide-react";

import { TASK_PRIORITY, TASK_STATUS } from "../../utils/projectColors.js";
import { cn } from "../../utils/cn.js";

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "todo", label: TASK_STATUS.todo.label },
  { key: "in-progress", label: TASK_STATUS["in-progress"].label },
  { key: "in-review", label: TASK_STATUS["in-review"].label },
  { key: "done", label: TASK_STATUS.done.label },
];

const SORTS = [
  { key: "due", label: "Deadline" },
  { key: "priority", label: "Priority" },
  { key: "created", label: "Created" },
  { key: "updated", label: "Updated" },
  { key: "title", label: "Title" },
];

const SELECT_CLASS =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-all hover:border-brand-200 focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-500/10";

const selectStyle = { backgroundImage: "none" };

/**
 * Search + filter + sort controls for the task list.
 * Everything is server-side (q / status / priority / assignee / label /
 * projectId / sort / order), so results stay consistent at any scale.
 */
export default function TaskFilters({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  onClear,
  projects,
  labelOptions,
  showSort = true,
}) {
  const activeProject = filters.projectId
    ? (projects || []).find((p) => p.id === filters.projectId)
    : null;
  const showArchivedProject =
    activeProject && activeProject.status === "archived";

  return (
    <div className="space-y-3">
      {/* Search + status pills + sort */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search tasks…"
            aria-label="Search tasks"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 transition-all focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status pills */}
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key || "all"}
              type="button"
              onClick={() => onFilterChange({ status: key })}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                filters.status === key
                  ? "bg-brand-600 text-white shadow-soft"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700"
              )}
            >
              {label}
            </button>
          ))}

          {/* Sort + order */}
          {showSort ? (
          <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
            <label htmlFor="task-sort" className="sr-only">
              Sort tasks
            </label>
            <select
              id="task-sort"
              value={filters.sort}
              onChange={(event) => onFilterChange({ sort: event.target.value })}
              style={selectStyle}
              className={SELECT_CLASS}
            >
              {SORTS.map(({ key, label }) => (
                <option key={key} value={key}>
                  Sort: {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                onFilterChange({ order: filters.order === "desc" ? "asc" : "desc" })
              }
              aria-label={
                filters.order === "desc"
                  ? "Switch to ascending order"
                  : "Switch to descending order"
              }
              title={
                filters.order === "desc" ? "Descending" : "Ascending"
              }
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-brand-200 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20"
            >
              {filters.order === "desc" ? (
                <ArrowDown className="h-4 w-4" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          </div>
          ) : null}
        </div>
      </div>

      {/* Secondary filters */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="task-priority" className="sr-only">
          Filter by priority
        </label>
        <select
          id="task-priority"
          value={filters.priority}
          onChange={(event) => onFilterChange({ priority: event.target.value })}
          style={selectStyle}
          className={cn(SELECT_CLASS, filters.priority && "border-brand-300 text-brand-700")}
        >
          <option value="">Any priority</option>
          {Object.entries(TASK_PRIORITY).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <label htmlFor="task-assignee" className="sr-only">
          Filter by assignee
        </label>
        <select
          id="task-assignee"
          value={filters.assignee}
          onChange={(event) => onFilterChange({ assignee: event.target.value })}
          style={selectStyle}
          className={cn(SELECT_CLASS, filters.assignee && "border-brand-300 text-brand-700")}
        >
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
        </select>

        <label htmlFor="task-label" className="sr-only">
          Filter by label
        </label>
        <select
          id="task-label"
          value={filters.label}
          onChange={(event) => onFilterChange({ label: event.target.value })}
          style={selectStyle}
          className={cn(SELECT_CLASS, filters.label && "border-brand-300 text-brand-700")}
        >
          <option value="">Any label</option>
          {labelOptions.map((label) => (
            <option key={label} value={label}>
              #{label}
            </option>
          ))}
        </select>

        <label htmlFor="task-project" className="sr-only">
          Filter by project
        </label>
        <select
          id="task-project"
          value={filters.projectId}
          onChange={(event) => onFilterChange({ projectId: event.target.value })}
          style={selectStyle}
          className={cn(
            SELECT_CLASS,
            filters.projectId && "border-brand-300 text-brand-700"
          )}
        >
          <option value="">All projects</option>
          {(projects || [])
            .filter((project) => project.status !== "archived" || showArchivedProject)
            .map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
        </select>

        {/* Clear (only when something is active) */}
        {(filters.q ||
          filters.status ||
          filters.priority ||
          filters.assignee ||
          filters.label ||
          filters.projectId) ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
