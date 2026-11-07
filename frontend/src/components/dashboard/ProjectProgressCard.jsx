import { Link } from "react-router-dom";
import { ArrowRight, FolderKanban } from "lucide-react";

import Card from "../ui/Card.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import { projectColor } from "../../utils/projectColors.js";
import { cn } from "../../utils/cn.js";

/** Horizontal progress bars: tasks completed per project. */
export default function ProjectProgressCard({ projects }) {
  return (
    <Card
      title="Project Progress"
      subtitle="Completion by project"
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
          title="Nothing to chart yet"
          description="Once your projects have tasks, their progress shows up here."
        />
      ) : (
        <ul className="space-y-4">
          {projects.map((project) => {
            const color = projectColor(project.color);
            return (
              <li key={project.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-800">
                    <span
                      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", color.dot)}
                    />
                    <span className="truncate">{project.name}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">
                    {project.doneTasks}/{project.totalTasks} tasks ·{" "}
                    <span className="font-bold text-slate-700">
                      {project.progress}%
                    </span>
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
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
