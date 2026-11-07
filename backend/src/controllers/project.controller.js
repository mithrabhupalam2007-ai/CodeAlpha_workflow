const mongoose = require("mongoose");

const Project = require("../models/Project");
const Task = require("../models/Task");
const Activity = require("../models/Activity");
const TaskActivity = require("../models/TaskActivity");
const Invitation = require("../models/Invitation");
const events = require("../sockets/events");
const {
  allProjectMatch,
  getProjectIds,
  getProgressByProject,
} = require("../services/stats");
const {
  idOf,
  getProjectRole,
  canManageSettings,
  canManageMembers,
  canActOnMember,
} = require("../utils/permissions");

const notFound = (res) =>
  res.status(404).json({
    success: false,
    message: "Project not found or you don’t have access to it.",
  });

const forbidden = (res, message = "You don’t have permission to do that.") =>
  res.status(403).json({ success: false, message });

const conflict = (res, message) => res.status(409).json({ success: false, message });

const badRequest = (res, message) => res.status(400).json({ success: false, message });

/** Serialize a (lean) project — shared by list/detail/create/update. */
const serializeProject = (project, progress, myRole) => {
  const stats = progress.get(String(project._id)) || {
    total: 0,
    done: 0,
    percent: 0,
  };

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
    owner: project.owner
      ? {
          id: project.owner._id ?? project.owner,
          name: project.owner.name ?? null,
          email: project.owner.email ?? null,
        }
      : null,
    members: (project.members || []).map((member) => ({
      id: member.user?._id ?? member.user,
      name: member.user?.name ?? null,
      email: member.user?.email ?? null,
      role: member.role,
      joinedAt: member.joinedAt,
    })),
    myRole: myRole || null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
};

/**
 * Load a project the requester is a member of.
 * Non-members get `null` so every endpoint answers 404 (no existence leak).
 */
const loadProjectForMember = async (userId, projectId) => {
  if (!mongoose.isValidObjectId(projectId)) return null;

  const project = await Project.findById(projectId)
    .populate("members.user", "name email")
    .populate("owner", "name email")
    .lean();

  if (!project) return null;
  if (!getProjectRole(project, userId)) return null;
  return project;
};

/**
 * GET /api/projects
 * All projects the user owns or belongs to (archived included —
 * the client filters), with real task progress per project.
 */
const listProjects = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [projects, projectIds] = await Promise.all([
      Project.find(allProjectMatch(userId))
        .sort({ createdAt: -1 })
        .populate("members.user", "name")
        .lean(),
      getProjectIds(userId, { includeArchived: true }),
    ]);

    const progress = await getProgressByProject(projectIds);

    return res.json({
      success: true,
      count: projects.length,
      projects: projects.map((project) =>
        serializeProject(
          project,
          progress,
          getProjectRole(project, userId)
        )
      ),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/projects
 * Create a project; the creator becomes owner (and first member).
 */
const createProject = async (req, res, next) => {
  try {
    const { name, description, color, dueDate, status } = req.body;

    const project = await Project.create({
      name,
      description: description ?? "",
      color: color ?? "indigo",
      dueDate: dueDate ? new Date(dueDate) : null,
      status: status === "on-hold" || status === "completed" ? status : "active",
      owner: req.user.id,
      members: [{ user: req.user.id, role: "owner" }],
    });

    const populated = await Project.findById(project._id)
      .populate("members.user", "name email")
      .populate("owner", "name email")
      .lean();

    return res.status(201).json({
      success: true,
      project: serializeProject(populated, new Map(), "owner"),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/projects/:id
 * Full project detail (members, roles, progress) — members only.
 */
const getProject = async (req, res, next) => {
  try {
    const project = await loadProjectForMember(req.user.id, req.params.id);
    if (!project) return notFound(res);

    const progress = await getProgressByProject([project._id]);

    return res.json({
      success: true,
      project: serializeProject(
        project,
        progress,
        getProjectRole(project, req.user.id)
      ),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/projects/:id
 * Edit project settings — owner only, not while archived.
 */
const updateProject = async (req, res, next) => {
  try {
    const project = await loadProjectForMember(req.user.id, req.params.id);
    if (!project) return notFound(res);

    const role = getProjectRole(project, req.user.id);
    if (!canManageSettings(role)) {
      return forbidden(res, "Only the project owner can change project settings.");
    }
    if (project.status === "archived") {
      return conflict(res, "This project is archived. Restore it before editing.");
    }

    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.color !== undefined) updates.color = req.body.color;
    if (req.body.dueDate !== undefined) {
      updates.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
    }
    if (req.body.status !== undefined) updates.status = req.body.status;

    const updated = await Project.findByIdAndUpdate(
      project._id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate("members.user", "name email")
      .populate("owner", "name email")
      .lean();

    const progress = await getProgressByProject([updated._id]);

    return res.json({
      success: true,
      project: serializeProject(updated, progress, role),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/projects/:id/archive — owner only.
 */
const archiveProject = async (req, res, next) => {
  try {
    const project = await loadProjectForMember(req.user.id, req.params.id);
    if (!project) return notFound(res);
    if (!canManageSettings(getProjectRole(project, req.user.id))) {
      return forbidden(res, "Only the project owner can archive a project.");
    }
    if (project.status === "archived") {
      return conflict(res, "This project is already archived.");
    }

    const updated = await Project.findByIdAndUpdate(
      project._id,
      { $set: { status: "archived" } },
      { new: true }
    )
      .populate("members.user", "name email")
      .populate("owner", "name email")
      .lean();

    const progress = await getProgressByProject([updated._id]);

    return res.json({
      success: true,
      project: serializeProject(updated, progress, "owner"),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/projects/:id/restore — owner only (archived → active).
 */
const restoreProject = async (req, res, next) => {
  try {
    const project = await loadProjectForMember(req.user.id, req.params.id);
    if (!project) return notFound(res);
    if (!canManageSettings(getProjectRole(project, req.user.id))) {
      return forbidden(res, "Only the project owner can restore a project.");
    }
    if (project.status !== "archived") {
      return conflict(res, "This project is not archived.");
    }

    const updated = await Project.findByIdAndUpdate(
      project._id,
      { $set: { status: "active" } },
      { new: true }
    )
      .populate("members.user", "name email")
      .populate("owner", "name email")
      .lean();

    const progress = await getProgressByProject([updated._id]);

    return res.json({
      success: true,
      project: serializeProject(updated, progress, "owner"),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/projects/:id — owner only; cascades tasks, activity, invitations.
 */
const deleteProject = async (req, res, next) => {
  try {
    const project = await loadProjectForMember(req.user.id, req.params.id);
    if (!project) return notFound(res);
    if (!canManageSettings(getProjectRole(project, req.user.id))) {
      return forbidden(res, "Only the project owner can delete a project.");
    }

    const [tasks, taskActivities, activities, invitations] = await Promise.all([
      Task.deleteMany({ project: project._id }),
      TaskActivity.deleteMany({ project: project._id }),
      Activity.deleteMany({ project: project._id }),
      Invitation.deleteMany({ project: project._id }),
      Project.deleteOne({ _id: project._id }),
    ]);

    return res.json({
      success: true,
      message: "Project deleted.",
      deleted: {
        tasks: tasks.deletedCount,
        activities: activities.deletedCount,
        invitations: invitations.deletedCount,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/projects/:id/members/:userId  { role }
 * Assign a project role — owner only (admins can't promote to admin).
 */
const updateMemberRole = async (req, res, next) => {
  try {
    const project = await loadProjectForMember(req.user.id, req.params.id);
    if (!project) return notFound(res);

    const requesterRole = getProjectRole(project, req.user.id);
    if (!canManageSettings(requesterRole)) {
      return forbidden(res, "Only the project owner can assign project roles.");
    }
    if (project.status === "archived") {
      return conflict(res, "This project is archived. Restore it before managing members.");
    }

    const { userId: targetId } = req.params;
    const { role } = req.body;
    if (!mongoose.isValidObjectId(targetId)) return badRequest(res, "Invalid member id.");

    const target = (project.members || []).find(
      (member) => idOf(member.user) === String(targetId)
    );
    if (!target) return notFound(res);
    if (idOf(project.owner) === String(targetId)) {
      return conflict(res, "The project owner’s role can’t be changed.");
    }
    if (target.role === role) {
      return res.json({ success: true, role, unchanged: true });
    }

    await Project.updateOne(
      { _id: project._id, "members.user": targetId },
      { $set: { "members.$.role": role } }
    );

    events.projectMembers(project._id, "role-changed", targetId, req.user.id);
    events.notifyUser(targetId, {
      actorId: req.user.id,
      actorName: req.user.name,
      type: "project.updated",
      message: `changed your role in “${project.name}” to ${role}`,
      projectId: project._id,
    });

    return res.json({
      success: true,
      message: `Role updated to ${role}.`,
      userId: targetId,
      role,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/projects/:id/members/:userId
 * Remove a member — owner can remove anyone but themselves;
 * admins can remove editors & viewers only. Archived: blocked.
 */
const removeMember = async (req, res, next) => {
  try {
    const project = await loadProjectForMember(req.user.id, req.params.id);
    if (!project) return notFound(res);

    const requesterRole = getProjectRole(project, req.user.id);
    if (!canManageMembers(requesterRole)) {
      return forbidden(res, "You don’t have permission to remove members.");
    }
    if (project.status === "archived") {
      return conflict(res, "This project is archived. Restore it before managing members.");
    }

    const { userId: targetId } = req.params;
    if (!mongoose.isValidObjectId(targetId)) return badRequest(res, "Invalid member id.");

    const target = (project.members || []).find(
      (member) => idOf(member.user) === String(targetId)
    );
    if (!target) return notFound(res);
    if (idOf(project.owner) === String(targetId)) {
      return forbidden(res, "The project owner can’t be removed.");
    }

    const targetRole = target.role;
    if (!canActOnMember(requesterRole, targetRole)) {
      return forbidden(
        res,
        "Admins can only remove editors and viewers — ask the owner."
      );
    }

    await Project.updateOne(
      { _id: project._id },
      { $pull: { members: { user: targetId } } }
    );

    events.kickUserFromProject(targetId, project._id);
    events.projectMembers(project._id, "removed", targetId, req.user.id);
    events.notifyUser(targetId, {
      actorId: req.user.id,
      actorName: req.user.name,
      type: "member.removed",
      message: `removed you from “${project.name}”`,
      projectId: project._id,
    });

    return res.json({
      success: true,
      message: "Member removed.",
      userId: targetId,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listProjects,
  createProject,
  getProject,
  updateProject,
  archiveProject,
  restoreProject,
  deleteProject,
  updateMemberRole,
  removeMember,
  loadProjectForMember,
  serializeProject,
};
