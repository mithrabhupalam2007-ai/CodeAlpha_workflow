import apiClient from "./client.js";

/**
 * GET /api/dashboard/summary — stats + all dashboard panels in one call.
 * Returns { stats, weeklyCompleted, projectProgress, recentProjects,
 *          myTasks, upcomingDeadlines, recentActivity }
 */
export const getDashboardSummary = async () =>
  (await apiClient.get("/dashboard/summary")).data;

/** GET /api/dashboard/activity?limit=8 — topbar notification feed. */
export const getActivity = async (limit = 8) =>
  (await apiClient.get(`/dashboard/activity?limit=${limit}`)).data;
