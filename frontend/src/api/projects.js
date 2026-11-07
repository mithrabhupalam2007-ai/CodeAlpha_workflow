import apiClient from "./client.js";

/** GET /api/projects — all projects the user belongs to, with real progress. */
export const getProjects = async () => (await apiClient.get("/projects")).data;

/** GET /api/projects/:id — full detail (members, roles, myRole, progress). */
export const getProject = async (id) =>
  (await apiClient.get(`/projects/${id}`)).data;

/** POST /api/projects — create; creator becomes owner. */
export const createProject = async (payload) =>
  (await apiClient.post("/projects", payload)).data;

/** PATCH /api/projects/:id — edit settings (owner only). */
export const updateProject = async (id, payload) =>
  (await apiClient.patch(`/projects/${id}`, payload)).data;

/** POST /api/projects/:id/archive — owner only. */
export const archiveProject = async (id) =>
  (await apiClient.post(`/projects/${id}/archive`)).data;

/** POST /api/projects/:id/restore — owner only. */
export const restoreProject = async (id) =>
  (await apiClient.post(`/projects/${id}/restore`)).data;

/** DELETE /api/projects/:id — owner only; cascades tasks/activity/invites. */
export const deleteProject = async (id) =>
  (await apiClient.delete(`/projects/${id}`)).data;

/** PATCH /api/projects/:id/members/:userId { role } — owner only. */
export const updateMemberRole = async (projectId, userId, role) =>
  (await apiClient.patch(`/projects/${projectId}/members/${userId}`, { role }))
    .data;

/** DELETE /api/projects/:id/members/:userId — owner/admin. */
export const removeMember = async (projectId, userId) =>
  (await apiClient.delete(`/projects/${projectId}/members/${userId}`)).data;
