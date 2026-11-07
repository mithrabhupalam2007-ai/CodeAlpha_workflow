/**
 * Realtime broadcasting + instant notifications.
 *
 * Every helper here must be called AFTER the MongoDB write it describes
 * has been awaited — persistence first, broadcast second — so all members
 * converge on consistent data. All helpers are safe when Socket.IO isn't
 * running (io === null in e.g. unit tests): they simply do nothing.
 *
 * Event catalogue (rooms: `project:<id>`, `user:<id>`):
 *   task:created    { projectId, taskId, task, actor      }
 *   task:updated    { projectId, taskId, task, actor      }
 *   task:moved      { projectId, taskId, task, from, actor}
 *   task:commented  { projectId, taskId, task, commentId, actor}
 *   task:deleted    { projectId, taskId, actor            }
 *   project:members { projectId, members, action, userId, actor }
 *   notification:new  → sent to the recipient's `user:<id>` room only, and
 *                       ALWAYS persisted as an Activity row before emitting.
 */

const { getIO } = require("./socket");
const Activity = require("../models/Activity");
const { idOf } = require("../utils/permissions");
const Project = require("../models/Project");

/** Each user gets a private room for instant notifications. */
const userRoom = (userId) => `user:${userId}`;
/** One room per project board — members verified at join time. */
const projectRoom = (projectId) => `project:${projectId}`;

const io = () => getIO();

// ---------- direct emitters (already-authorized rooms) ----------

const emitToRoom = (room, event, payload) => {
  const s = io();
  if (!s || !room || payload === undefined) return false;
  s.to(room).emit(event, payload);
  return true;
};

const emitToUser = (userId, event, payload) => {
  if (!userId) return false;
  return emitToRoom(userRoom(String(userId)), event, payload);
};

/** Server-side room management (used to kick removed members). */
const kickUserFromProject = (userId, projectId) => {
  const s = io();
  if (!s || !userId || !projectId) return;
  s.in(userRoom(String(userId))).socketsLeave(projectRoom(projectId));
};

// ---------- domain broadcasts (call AFTER persisting) ----------

const taskCreated = (projectId, task, actorId) => {
  if (!task) return;
  emitToRoom(projectRoom(projectId), "task:created", {
    projectId: String(projectId),
    taskId: String(task.id ?? task._id),
    task,
    actor: actorId ? String(actorId) : null,
  });
};

const taskUpdated = (projectId, task, actorId) => {
  if (!task) return;
  emitToRoom(projectRoom(projectId), "task:updated", {
    projectId: String(projectId),
    taskId: String(task.id ?? task._id),
    task,
    actor: actorId ? String(actorId) : null,
  });
};

const taskMoved = (projectId, task, actorId, from = null) => {
  if (!task) return;
  emitToRoom(projectRoom(projectId), "task:moved", {
    projectId: String(projectId),
    taskId: String(task.id ?? task._id),
    task,
    from: from ?? null,
    actor: actorId ? String(actorId) : null,
  });
};

const taskCommented = (projectId, task, commentId, actorId) => {
  if (!task) return;
  emitToRoom(projectRoom(projectId), "task:commented", {
    projectId: String(projectId),
    taskId: String(task.id ?? task._id),
    task,
    commentId: commentId ? String(commentId) : null,
    actor: actorId ? String(actorId) : null,
  });
};

const taskDeleted = (projectId, taskId, actorId) => {
  emitToRoom(projectRoom(projectId), "task:deleted", {
    projectId: String(projectId),
    taskId: String(taskId),
    actor: actorId ? String(actorId) : null,
  });
};

/**
 * Membership changed — RESTful members list is re-read by clients, but the
 * event lets them refresh instantly (and detect their own removal).
 */
const projectMembers = async (projectId, action, userId, actorId) => {
  const members = await Project.findById(projectId)
    .select("members")
    .populate("members.user", "name email")
    .lean()
    .catch(() => null);
  if (!members) return;

  emitToRoom(projectRoom(projectId), "project:members", {
    projectId: String(projectId),
    members: (members.members || []).map((m) => ({
      user: m.user?._id
        ? { id: m.user._id, name: m.user.name, email: m.user.email }
        : { id: m.user },
      role: m.role,
    })),
    action, // "joined" | "removed" | "role-changed"
    userId: userId ? String(userId) : null,
    actor: actorId ? String(actorId) : null,
  });
};

/**
 * Persist a notification row for one user, then deliver it instantly.
 * Never records self-notifications and never lets WebSocket/database
 * failures break the action that triggered them.
 */
const notifyUser = async (userId, fields) => {
  const { actorId, type, message, projectId = null, taskId = null } = fields;
  const recipient = idOf(userId);
  const actor = idOf(actorId);
  if (!recipient || !actor || recipient === actor) return;

  try {
    const entry = await Activity.create({
      user: recipient,
      actor,
      type,
      message,
      project: projectId,
      task: taskId,
    });

    // Shape mirrors GET /api/dashboard/activity entries so the bell can
    // prepend it without refetching.
    emitToUser(userId, "notification:new", {
      id: entry._id,
      type: entry.type,
      message: entry.message,
      actor: { id: actorId, name: fields.actorName ?? null },
      projectId: projectId ? String(projectId) : null,
      createdAt: entry.createdAt,
    });
  } catch (error) {
    console.error("notification write failed:", error.message);
  }
};

module.exports = {
  userRoom,
  projectRoom,
  emitToRoom,
  emitToUser,
  kickUserFromProject,
  taskCreated,
  taskUpdated,
  taskMoved,
  taskCommented,
  taskDeleted,
  projectMembers,
  notifyUser,
};
