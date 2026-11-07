import apiClient from "./client.js";

/** Strip empty values so the URL only carries active filters. */
const buildParams = (params = {}) => {
  const query = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === "all") continue;
    query[key] = value;
  }
  return query;
};

/**
 * GET /api/tasks — search + filter + sort across my projects.
 * Params: projectId, q, status, priority, assignee (me|none|id), label,
 * sort (due|priority|created|updated|title), order (asc|desc).
 */
export const getTasks = async (params = {}) =>
  (await apiClient.get("/tasks", { params: buildParams(params) })).data;

/** PATCH /api/tasks/:id/move — kanban DnD: set status and/or column order. */
export const moveTask = async (id, payload) =>
  (await apiClient.patch(`/tasks/${id}/move`, payload)).data;

/** GET /api/tasks/:id — full detail incl. project members (assignee picker). */
export const getTask = async (id) => (await apiClient.get(`/tasks/${id}`)).data;

/** POST /api/tasks — create (editor+; assignee must be a project member). */
export const createTask = async (payload) =>
  (await apiClient.post("/tasks", payload)).data;

/** PATCH /api/tasks/:id — edit fields (editor+). Status has its own call. */
export const updateTask = async (id, payload) =>
  (await apiClient.patch(`/tasks/${id}`, payload)).data;

/** PATCH /api/tasks/:id/status — editor+ or the task's assignee. */
export const setTaskStatus = async (id, status) =>
  (await apiClient.patch(`/tasks/${id}/status`, { status })).data;

/** DELETE /api/tasks/:id — editor+. */
export const deleteTask = async (id) =>
  (await apiClient.delete(`/tasks/${id}`)).data;

// ---------- subtasks (editor+ or assignee) ----------

export const addSubtask = async (id, title) =>
  (await apiClient.post(`/tasks/${id}/subtasks`, { title })).data;

export const updateSubtask = async (id, subId, payload) =>
  (await apiClient.patch(`/tasks/${id}/subtasks/${subId}`, payload)).data;

export const removeSubtask = async (id, subId) =>
  (await apiClient.delete(`/tasks/${id}/subtasks/${subId}`)).data;

// ---------- attachments (link-based or file upload; editor+ or assignee) ----------

export const addAttachment = async (id, payload) =>
  (await apiClient.post(`/tasks/${id}/attachments`, payload)).data;

/** Multipart file upload (8 MB cap, extension allowlist on the server). */
export const uploadAttachment = async (id, file, name) => {
  const form = new FormData();
  form.append("file", file);
  if (name) form.append("name", name);
  return (await apiClient.post(`/tasks/${id}/attachments/upload`, form)).data;
};

export const removeAttachment = async (id, attachmentId) =>
  (await apiClient.delete(`/tasks/${id}/attachments/${attachmentId}`)).data;

/** GET /api/tasks/:id/activity — task history, newest first. */
export const getTaskActivity = async (id, limit = 100) =>
  (await apiClient.get(`/tasks/${id}/activity`, { params: { limit } })).data;

// ---------- comments (threaded) ----------
// Add/reply: any project member (viewers included).
// Edit: the comment's author only. Delete: author or editor+.

export const addComment = async (id, text, parentId) =>
  (
    await apiClient.post(`/tasks/${id}/comments`, {
      text,
      ...(parentId ? { parentId } : {}),
    })
  ).data;

export const editComment = async (id, commentId, text) =>
  (await apiClient.patch(`/tasks/${id}/comments/${commentId}`, { text })).data;

export const removeComment = async (id, commentId) =>
  (await apiClient.delete(`/tasks/${id}/comments/${commentId}`)).data;
