import { Link } from "react-router-dom";
import {
  AlarmClock,
  CheckCircle2,
  CircleAlert,
  FolderKanban,
  ListChecks,
  RefreshCw,
} from "lucide-react";

import StatCard from "../components/ui/StatCard.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import DashboardSkeleton from "../components/dashboard/DashboardSkeleton.jsx";
import ProjectProgressCard from "../components/dashboard/ProjectProgressCard.jsx";
import StatusDonutCard from "../components/dashboard/StatusDonutCard.jsx";
import MyTasksCard from "../components/dashboard/MyTasksCard.jsx";
import UpcomingDeadlinesCard from "../components/dashboard/UpcomingDeadlinesCard.jsx";
import RecentProjectsCard from "../components/dashboard/RecentProjectsCard.jsx";
import ActivityFeedCard from "../components/dashboard/ActivityFeedCard.jsx";
import WeeklyCompletionsCard from "../components/dashboard/WeeklyCompletionsCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import useDashboard from "../hooks/useDashboard.js";

/**
 * Dashboard — every number below comes from GET /api/dashboard/summary.
 * Handles loading (skeleton), error (retry), and empty (no projects) states.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const { summary, loading, error, refetch } = useDashboard();

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // ---- Loading ----
  if (loading && !summary) return <DashboardSkeleton />;

  // ---- Error ----
  if (error && !summary) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md rounded-panel border border-slate-200/70 bg-surface p-8 text-center shadow-soft">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
            <CircleAlert className="h-6 w-6" />
          </span>
          <h2 className="text-lg font-bold text-slate-900">
            Couldn’t load your dashboard
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {error?.message ||
              "Something went wrong while fetching your statistics. Check that the API is running and try again."}
          </p>
          <button
            type="button"
            onClick={refetch}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-700"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  const stats = summary.stats;
  const isEmpty =
    stats.totalProjects === 0 && stats.totalTasks === 0;

  const statCards = [
    {
      label: "Total Projects",
      value: stats.totalProjects,
      icon: FolderKanban,
      tone: "indigo",
      hint: `${summary.recentProjects.length} recent`,
      hintTone: "indigo",
    },
    {
      label: "Total Tasks",
      value: stats.totalTasks,
      icon: ListChecks,
      tone: "blue",
      hint: `${stats.openTasks} open`,
      hintTone: "slate",
    },
    {
      label: "Completed Tasks",
      value: stats.completedTasks,
      icon: CheckCircle2,
      tone: "emerald",
      hint: `${stats.completionRate}% done`,
      hintTone: "emerald",
    },
    {
      label: "Overdue Tasks",
      value: stats.overdueTasks,
      icon: AlarmClock,
      tone: "rose",
      hint: stats.overdueTasks > 0 ? "Needs attention" : "All on track",
      hintTone: stats.overdueTasks > 0 ? "rose" : "emerald",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome back, {firstName} 👋
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Here’s what’s happening in your workspace today.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-500 shadow-soft">
          {today}
        </span>
      </div>

      {/* Stats — real counters from the API */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat, index) => (
          <StatCard
            key={stat.label}
            {...stat}
            style={{ animationDelay: `${index * 70}ms` }}
            className="animate-slide-up"
          />
        ))}
      </div>

      {/* Empty workspace — nothing to chart yet */}
      {isEmpty ? (
        <EmptyState
          icon={FolderKanban}
          title="Welcome to WorkFlow!"
          description="You don’t have any projects yet. Create your first project to start tracking tasks, deadlines and progress."
          action={
            <Link
              to="/projects"
              className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-700"
            >
              Create your first project
            </Link>
          }
          className="py-16"
        />
      ) : (
        <>
          {/* Charts row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ProjectProgressCard projects={summary.projectProgress} />
            </div>
            <StatusDonutCard
              byStatus={stats.byStatus}
              completionRate={stats.completionRate}
            />
          </div>

          {/* Tasks row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <MyTasksCard tasks={summary.myTasks} />
            <UpcomingDeadlinesCard tasks={summary.upcomingDeadlines} />
          </div>

          {/* Projects / activity / trend row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <RecentProjectsCard projects={summary.recentProjects} />
            <ActivityFeedCard entries={summary.recentActivity} />
            <WeeklyCompletionsCard data={summary.weeklyCompleted} />
          </div>
        </>
      )}

      {/* Quiet hint when a background refresh is in flight */}
      {loading && summary ? (
        <p className="text-center text-xs text-slate-400">Refreshing…</p>
      ) : null}
    </div>
  );
}
