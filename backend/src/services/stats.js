const Project = require("../models/Project");
const Task = require("../models/Task");

/** Local midnight (today 00:00). */
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const localDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

/** Projects the user can see: owned by them or a member (archived excluded). */
const workspaceProjectMatch = (userId) => ({
  "members.user": userId,
  status: { $ne: "archived" },
});

/** Same, but including archived (used by the projects list page). */
const allProjectMatch = (userId) => ({
  "members.user": userId,
});

const getProjectIds = async (userId, { includeArchived = false } = {}) => {
  const match = includeArchived ? allProjectMatch(userId) : workspaceProjectMatch(userId);
  const rows = await Project.find(match).select("_id").lean();
  return rows.map((row) => row._id);
};

/** Map of projectId → { total, done, percent } across all task statuses. */
const getProgressByProject = async (projectIds) => {
  if (projectIds.length === 0) return new Map();

  const rows = await Task.aggregate([
    { $match: { project: { $in: projectIds } } },
    {
      $group: {
        _id: "$project",
        total: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
      },
    },
  ]);

  const map = new Map();
  for (const row of rows) {
    map.set(String(row._id), {
      total: row.total,
      done: row.done,
      percent: row.total ? Math.round((row.done / row.total) * 100) : 0,
    });
  }
  return map;
};

/**
 * Tasks completed per day for the last 7 days (local timezone).
 * Returns [{ date: "YYYY-MM-DD", count }] — always 7 entries, oldest first.
 */
const getWeeklyCompleted = async (projectIds) => {
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = startOfToday();
    d.setDate(d.getDate() - i);
    days.push({ date: localDateKey(d), count: 0 });
  }

  if (projectIds.length === 0) return days;

  const since = days[0] ? new Date(`${days[0].date}T00:00:00`) : startOfToday();
  const docs = await Task.find({
    project: { $in: projectIds },
    status: "done",
    completedAt: { $gte: since },
  })
    .select("completedAt")
    .lean();

  const indexByDate = new Map(days.map((day, i) => [day.date, i]));
  for (const doc of docs) {
    if (!doc.completedAt) continue;
    const key = localDateKey(doc.completedAt);
    const idx = indexByDate.get(key);
    if (idx !== undefined) days[idx].count += 1;
  }

  return days;
};

/** Core counters for the dashboard stat cards (single pass per counter). */
const getTaskCounters = async (projectIds) => {
  const base = { project: { $in: projectIds } };
  const today = startOfToday();

  const [
    totalTasks,
    doneTasks,
    overdueTasks,
    todoTasks,
    inProgressTasks,
    inReviewTasks,
  ] = await Promise.all([
    Task.countDocuments(base),
    Task.countDocuments({ ...base, status: "done" }),
    Task.countDocuments({
      ...base,
      status: { $ne: "done" },
      dueDate: { $ne: null, $lt: today },
    }),
    Task.countDocuments({ ...base, status: "todo" }),
    Task.countDocuments({ ...base, status: "in-progress" }),
    Task.countDocuments({ ...base, status: "in-review" }),
  ]);

  return {
    totalTasks,
    doneTasks,
    overdueTasks,
    todoTasks,
    inProgressTasks,
    inReviewTasks,
  };
};

module.exports = {
  startOfToday,
  localDateKey,
  workspaceProjectMatch,
  allProjectMatch,
  getProjectIds,
  getProgressByProject,
  getWeeklyCompleted,
  getTaskCounters,
};
