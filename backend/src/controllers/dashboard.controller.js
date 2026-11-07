const Project = require("../models/Project");
const Task = require("../models/Task");
const Activity = require("../models/Activity");
const {
  workspaceProjectMatch,
  getProjectIds,
  getProgressByProject,
  getWeeklyCompleted,
  getTaskCounters,
} = require("../services/stats");

const asNumber = (value) => Number(value) || 0;

const serializeProject = (project, progress) => {
  const stats = progress.get(String(project._id)) || { total: 0, done: 0, percent: 0 };
  return {
    id: project._id,
    name: project.name,
    description: project.description,
    color: project.color,
    status: project.status,
    dueDate: project.dueDate,
    totalTasks: stats.total,
    doneTasks: stats.done,
    progress: stats.percent,
    members: (project.members || []).map((member) => ({
      id: member.user?._id ?? member.user,
      name: member.user?.name ?? null,
      role: member.role,
    })),
    createdAt: project.createdAt,
  };
};

/**
 * GET /api/dashboard/summary
 * Everything the dashboard needs in one call:
 * stats, weekly trend, project progress, recent projects,
 * my tasks, upcoming deadlines, recent activity.
 */
const getSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const projectIds = await getProjectIds(userId);

    const openTaskMatch = {
      assignee: userId,
      status: { $ne: "done" },
      project: { $in: projectIds }, // visible (non-archived) projects only
    };

    const [
      counters,
      weeklyCompleted,
      recentProjectsRaw,
      tasksWithDue,
      tasksWithoutDue,
      deadlinesRaw,
      activityRaw,
    ] = await Promise.all([
      getTaskCounters(projectIds),
      getWeeklyCompleted(projectIds),
        Project.find(workspaceProjectMatch(userId))
          .sort({ createdAt: -1 })
          .limit(5)
          .populate({ path: "members.user", select: "name" })
          .lean(),
        // Due-dated tasks first (nearest deadline wins), then tasks
        // without a due date — MongoDB would sort null dates first.
        Task.find({ ...openTaskMatch, dueDate: { $ne: null } })
          .sort({ dueDate: 1, priority: -1 })
          .limit(6)
          .populate("project", "name color")
          .lean(),
        Task.find({ ...openTaskMatch, dueDate: null })
          .sort({ priority: -1, updatedAt: -1 })
          .limit(6)
          .populate("project", "name color")
          .lean(),
        Task.find({
          project: { $in: projectIds },
          status: { $ne: "done" },
          dueDate: { $ne: null, $gte: new Date() },
        })
          .sort({ dueDate: 1 })
          .limit(6)
          .populate("project", "name color")
          .populate("assignee", "name")
          .lean(),
        Activity.find({ user: userId })
          .sort({ createdAt: -1 })
          .limit(8)
          .populate("actor", "name")
          .lean(),
      ]);

    const progress = await getProgressByProject(projectIds);

    const completionRate = counters.totalTasks
      ? Math.round((counters.doneTasks / counters.totalTasks) * 100)
      : 0;

    return res.json({
      success: true,
      stats: {
        totalProjects: projectIds.length,
        totalTasks: counters.totalTasks,
        completedTasks: counters.doneTasks,
        overdueTasks: counters.overdueTasks,
        openTasks: counters.totalTasks - counters.doneTasks,
        completionRate,
        byStatus: {
          todo: counters.todoTasks,
          "in-progress": counters.inProgressTasks,
          "in-review": counters.inReviewTasks,
          done: counters.doneTasks,
        },
      },
      weeklyCompleted,
      projectProgress: recentProjectsRaw
        .map((project) => serializeProject(project, progress))
        .filter((project) => project.totalTasks > 0),
      recentProjects: recentProjectsRaw.map((project) =>
        serializeProject(project, progress)
      ),
      myTasks: [...tasksWithDue, ...tasksWithoutDue]
        .slice(0, 6)
        .map((task) => ({
        id: task._id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        project: task.project
          ? { id: task.project._id, name: task.project.name, color: task.project.color }
          : null,
      })),
      upcomingDeadlines: deadlinesRaw.map((task) => ({
        id: task._id,
        title: task.title,
        priority: task.priority,
        dueDate: task.dueDate,
        status: task.status,
        project: task.project
          ? { id: task.project._id, name: task.project.name, color: task.project.color }
          : null,
        assignee: task.assignee ? { id: task.assignee._id, name: task.assignee.name } : null,
      })),
      recentActivity: activityRaw.map((entry) => ({
        id: entry._id,
        type: entry.type,
        message: entry.message,
        actor: entry.actor ? { id: entry.actor._id, name: entry.actor.name } : null,
        createdAt: entry.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/dashboard/activity?limit=8
 * Lightweight feed for the topbar notification dropdown.
 */
const getActivity = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 20);

    const entries = await Activity.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("actor", "name")
      .lean();

    return res.json({
      success: true,
      count: entries.length,
      activity: entries.map((entry) => ({
        id: entry._id,
        type: entry.type,
        message: entry.message,
        actor: entry.actor ? { id: entry.actor._id, name: entry.actor.name } : null,
        createdAt: entry.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getSummary, getActivity };
