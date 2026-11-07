/**
 * Frontend mirror of backend/src/utils/permissions.js — keep in sync.
 *
 *   role      view   edit settings   manage members*   assign roles
 *   owner      ✓           ✓                ✓              ✓
 *   admin      ✓           –                ✓†             –
 *   editor     ✓           –                –              –
 *   viewer     ✓           –                –              –
 *
 *  * invite / remove members   † admins can't touch admins or the owner
 */

export const ROLE_RANK = { viewer: 1, editor: 2, admin: 3, owner: 4 };

export const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export const ROLE_BADGES = {
  owner: "bg-brand-50 text-brand-600",
  admin: "bg-accent-50 text-accent-600",
  editor: "bg-emerald-50 text-emerald-600",
  viewer: "bg-slate-100 text-slate-500",
};

export const ROLE_DESCRIPTIONS = {
  admin: "Can invite and remove members, and view everything.",
  editor: "Can view the project and work on its tasks.",
  viewer: "Read-only access to the project.",
};

/** Roles that can be assigned through the UI (owner is set at creation). */
export const ASSIGNABLE_ROLES = ["admin", "editor", "viewer"];

const rank = (role) => ROLE_RANK[role] || 0;

export const canManageSettings = (role) => role === "owner";
export const canManageMembers = (role) => rank(role) >= rank("admin");

/** Owner: anyone but themselves. Admin: editors & viewers only. */
export const canActOnMember = (requesterRole, targetRole) => {
  if (requesterRole === "owner") return targetRole !== "owner";
  if (requesterRole === "admin") return rank(targetRole) < rank("admin");
  return false;
};

/** The role options an owner can pick for a member (excludes "owner"). */
export const roleSelectOptions = (currentRole) =>
  ASSIGNABLE_ROLES.filter((role) => role !== currentRole);

// ---------- task permissions (project role + task assignment) ----------

/** Create / edit / delete / reassign tasks: editor and above. */
export const canEditTasks = (role) => rank(role) >= rank("editor");

/**
 * Progress updates (status + subtasks): editor and above, OR the task's
 * own assignee may update their own task regardless of role.
 */
export const canUpdateTaskProgress = (role, task, userId) => {
  if (canEditTasks(role)) return true;
  return Boolean(task?.assignee) && task.assignee.id === userId;
};
