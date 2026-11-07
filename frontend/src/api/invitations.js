import apiClient from "./client.js";

/** GET /api/invitations/mine — pending invitations for my email. */
export const getMyInvitations = async () =>
  (await apiClient.get("/invitations/mine")).data;

/** GET /api/invitations?projectId= — pending invitations for a project (owner/admin). */
export const getProjectInvitations = async (projectId) =>
  (await apiClient.get(`/invitations?projectId=${projectId}`)).data;

/** POST /api/invitations { projectId, email, role } — invite by email (owner/admin). */
export const createInvitation = async ({ projectId, email, role }) =>
  (await apiClient.post("/invitations", { projectId, email, role })).data;

/** DELETE /api/invitations/:id — revoke a pending invitation. */
export const revokeInvitation = async (id) =>
  (await apiClient.delete(`/invitations/${id}`)).data;

/** POST /api/invitations/:id/accept — only the invited email may accept. */
export const acceptInvitation = async (id) =>
  (await apiClient.post(`/invitations/${id}/accept`)).data;

/** POST /api/invitations/:id/decline — only the invited email may decline. */
export const declineInvitation = async (id) =>
  (await apiClient.post(`/invitations/${id}/decline`)).data;
