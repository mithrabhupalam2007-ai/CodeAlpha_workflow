import { Link } from "react-router-dom";
import { ArrowRight, FolderKanban } from "lucide-react";

import Card from "../ui/Card.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import {
  PROJECT_STATUS,
  projectColor,
} from "../../utils/projectColors.js";
import { relativeTime } from "../../utils/dates.js";
import { cn } from "../../utils/cn.js";

/** Most recently created projects with a mini progress bar. */
export default function RecentProjectsCard({ projects }) {
  return (
    <Card
      title="Recent Projects"
      subtitle="Newest first"
      action={
        <Link
          to="/projects"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      {!projects || projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to start tracking work."
          action={
            <Link
              to="/projects"
              className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-700"
            >
              New project
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => {
            const color = projectColor(project.color);
            const status =
              PROJECT_STATUS[project.status] || PROJECT_STATUS.active;

            return (
              <li key={project.id}>
                <Link
                  to="/projects"
                  className="group flex items-center gap-3 rounded-xl border border-transparent p-2.5 transition-colors hover:border-slate-200 hover:bg-slate-50"
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-soft",
                      color.icon
                    )}
                  >
                    <FolderKanban className="h-4.5 w-4.5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-slate-900">
                        {project.name}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          status.className
                        )}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            "h-full rounded-full bg-gradient-to-r",
                            color.gradient
                          )}
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-500">
                        {project.progress}%
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                        {project.doneTasks}/{project.totalTasks}
                      </span>
                    </div>
                  </div>

                  <span className="hidden shrink-0 text-[11px] text-slate-400 sm:block">
                    {relativeTime(project.createdAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
