/**
 * Project permission model.
 *
 *   role      view   edit settings   manage members*   assign roles
 *   owner      ✓           ✓                ✓              ✓
 *   admin      ✓           –                ✓†             –
 *   editor     ✓           –                –              –
 *   viewer     ✓           –                –              –
 *
 *  * invite / remove members   † admins can't touch admins or the owner
 *
 * "Edit settings" covers update / archive / restore / delete — owner only,
 * per product requirement. Archived projects are read-only except restore
 * and delete (both owner-only).
 */

const ROLE_RANK = { viewer: 1, editor: 2, admin: 3, owner: 4 };

const rank = (role) => ROLE_RANK[role] || 0;

/**
 * Normalize a ref field to its id string — works whether the field is a
 * raw ObjectId or a populated document (`{ _id, name, ... }`).
 */
const idOf = (value) => {
  if (value == null) return null;
  if (typeof value === "object" && value._id !== undefined) return String(value._id);
  return String(value);
};

/** The requester's role on a (lean) project document, or null if not a member. */
const getProjectRole = (project, userId) => {
  if (!project || !userId) return null;
  if (idOf(project.owner) === String(userId)) return "owner";
  const member = (project.members || []).find(
    (entry) => idOf(entry.user) === String(userId)
  );
  return member ? member.role : null;
};

const canManageSettings = (role) => role === "owner";
const canManageMembers = (role) => role === "owner";
const canEditProject = (role) => rank(role) >= rank("editor");

/** An admin may remove/edit editors & viewers but never admins or the owner. */
const canActOnMember = (requesterRole, targetRole) => {
  if (requesterRole === "owner") return targetRole !== "owner";
  if (requesterRole === "admin") return rank(targetRole) < rank("admin");
  return false;
};

// ---------- task permissions (project role + task assignment) ----------

/** Create / edit / delete / reassign tasks: editor and above. */
const canEditTasks = (role) => rank(role) >= rank("editor");

/**
 * Progress updates (status + subtasks): editor and above, OR the task's
 * assignee may update their own task regardless of role.
 */
const canUpdateTaskProgress = (role, task, userId) => {
  if (canEditTasks(role)) return true;
  return Boolean(task?.assignee) && idOf(task.assignee) === String(userId);
};

module.exports = {
  ROLE_RANK,
  idOf,
  getProjectRole,
  canManageSettings,
  canManageMembers,
  canEditProject,
  canActOnMember,
  canEditTasks,
  canUpdateTaskProgress,
};
