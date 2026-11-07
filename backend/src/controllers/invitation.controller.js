const mongoose = require("mongoose");

const Invitation = require("../models/Invitation");
const Project = require("../models/Project");
const events = require("../sockets/events");
const { sendEmail } = require("../utils/sendEmail");
const {
  getProjectRole,
  canManageMembers,
} = require("../utils/permissions");
const { loadProjectForMember } = require("./project.controller");

const INVITE_TTL_DAYS = 7;

const notFound = (res) =>
  res.status(404).json({ success: false, message: "Invitation not found." });

const forbidden = (res, message = "You don’t have permission to do that.") =>
  res.status(403).json({ success: false, message });

const conflict = (res, message) => res.status(409).json({ success: false, message });

const isExpired = (invitation) =>
  invitation.expiresAt && new Date(invitation.expiresAt) < new Date();

const serializeInvitation = (invitation) => ({
  id: invitation._id,
  email: invitation.email,
  role: invitation.role,
  status: invitation.status,
  expiresAt: invitation.expiresAt,
  createdAt: invitation.createdAt,
  respondedAt: invitation.respondedAt,
  project: invitation.project
    ? {
        id: invitation.project._id ?? invitation.project,
        name: invitation.project.name ?? null,
        color: invitation.project.color ?? null,
        status: invitation.project.status ?? null,
      }
    : null,
  invitedBy: invitation.invitedBy
    ? {
        id: invitation.invitedBy._id ?? invitation.invitedBy,
        name: invitation.invitedBy.name ?? null,
      }
    : null,
});

/** Fire-and-forget invite email (console fallback when SMTP is not configured). */
const sendInviteEmail = async ({ email, role, projectName, inviterName }) => {
  try {
    await sendEmail({
      to: email,
      subject: `You're invited to “${projectName}” on WorkFlow`,
      text:
        `${inviterName} invited you to join the project “${projectName}” ` +
        `on WorkFlow as ${role}.\n\n` +
        `Sign in with this email address (${email}) and open the Projects ` +
        `page — you can accept or decline the invitation there.\n\n` +
        `The invitation expires in ${INVITE_TTL_DAYS} days.`,
    });
  } catch (error) {
    // Never fail the API call because email delivery failed.
    console.error("Invitation email failed:", error.message);
  }
};

/**
 * POST /api/invitations  { projectId, email, role }
 * Invite someone by email — requires "manage members" (owner/admin).
 * Re-sending refreshes an existing pending invitation.
 */
const createInvitation = async (req, res, next) => {
  try {
    const { projectId, email, role = "editor" } = req.body;
    const inviteEmail = String(email || "").trim().toLowerCase();

    const project = await loadProjectForMember(req.user.id, projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or you don’t have access to it.",
      });
    }

    const requesterRole = getProjectRole(project, req.user.id);
    if (!canManageMembers(requesterRole)) {
      return forbidden(res, "Only the project owner or an admin can invite members.");
    }
    if (project.status === "archived") {
      return conflict(res, "This project is archived. Restore it before inviting members.");
    }

    if (inviteEmail === String(req.user.email).toLowerCase()) {
      return res.status(400).json({ success: false, message: "You can’t invite yourself." });
    }

    const alreadyMember = (project.members || []).some(
      (member) => String(member.user?.email ?? "").toLowerCase() === inviteEmail
    );
    if (alreadyMember) {
      return conflict(res, "That person is already a member of this project.");
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * 86400000);

    // Refresh an existing pending invitation instead of duplicating it.
    const existing = await Invitation.findOne({
      project: project._id,
      email: inviteEmail,
      status: "pending",
    });

    let invitation;
    let reused = false;

    if (existing && !isExpired(existing)) {
      existing.role = role;
      existing.expiresAt = expiresAt;
      existing.invitedBy = req.user.id;
      invitation = await existing.save();
      reused = true;
    } else {
      if (existing) {
        // Stale pending doc (expired) — clear the way for the unique index.
        existing.status = "expired";
        await existing.save();
      }
      invitation = await Invitation.create({
        project: project._id,
        email: inviteEmail,
        role,
        invitedBy: req.user.id,
        expiresAt,
      });
    }

    await sendInviteEmail({
      email: inviteEmail,
      role,
      projectName: project.name,
      inviterName: req.user.name,
    });

    const populated = await Invitation.findById(invitation._id)
      .populate("project", "name color status")
      .populate("invitedBy", "name")
      .lean();

    return res.status(reused ? 200 : 201).json({
      success: true,
      message: reused
        ? `Invitation to ${inviteEmail} refreshed.`
        : `Invitation sent to ${inviteEmail}.`,
      invitation: serializeInvitation(populated),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/invitations?projectId=...
 * Pending invitations for a project — owner/admin only.
 */
const listProjectInvitations = async (req, res, next) => {
  try {
    const { projectId } = req.query;
    const project = await loadProjectForMember(req.user.id, projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or you don’t have access to it.",
      });
    }
    if (!canManageMembers(getProjectRole(project, req.user.id))) {
      return forbidden(res, "Only the project owner or an admin can view invitations.");
    }

    const now = new Date();
    const invitations = await Invitation.find({
      project: project._id,
      status: "pending",
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .populate("invitedBy", "name")
      .lean();

    return res.json({
      success: true,
      count: invitations.length,
      invitations: invitations.map(serializeInvitation),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/invitations/mine
 * Pending invitations addressed to the signed-in user's email.
 */
const listMyInvitations = async (req, res, next) => {
  try {
    const now = new Date();
    const invitations = await Invitation.find({
      email: String(req.user.email).toLowerCase(),
      status: "pending",
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .populate({ path: "project", select: "name color status" })
      .populate("invitedBy", "name")
      .lean();

    // Drop invitations whose project was deleted.
    const visible = invitations.filter((invitation) => invitation.project);

    return res.json({
      success: true,
      count: visible.length,
      invitations: visible.map(serializeInvitation),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/invitations/:id — revoke a pending invite (owner/admin).
 */
const revokeInvitation = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);

    const invitation = await Invitation.findById(req.params.id).lean();
    if (!invitation) return notFound(res);

    const project = await loadProjectForMember(req.user.id, invitation.project);
    if (!project) return notFound(res);
    if (!canManageMembers(getProjectRole(project, req.user.id))) {
      return forbidden(res, "Only the project owner or an admin can revoke invitations.");
    }
    if (invitation.status !== "pending") {
      return conflict(res, "This invitation is no longer pending.");
    }

    await Invitation.updateOne(
      { _id: invitation._id },
      { $set: { status: "revoked", respondedAt: new Date() } }
    );

    return res.json({ success: true, message: "Invitation revoked." });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/invitations/:id/accept | /decline
 * Only the account whose email matches the invitation may respond.
 */
const respondInvitation = (action) => async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);

    const invitation = await Invitation.findById(req.params.id)
      .populate("project", "name color status")
      .lean();
    if (!invitation || !invitation.project) return notFound(res);

    const userEmail = String(req.user.email).toLowerCase();
    if (invitation.email !== userEmail) {
      return forbidden(
        res,
        "This invitation was sent to a different email address."
      );
    }
    if (invitation.status !== "pending") {
      return conflict(res, `This invitation was already ${invitation.status}.`);
    }
    if (isExpired(invitation)) {
      await Invitation.updateOne(
        { _id: invitation._id },
        { $set: { status: "expired" } }
      );
      return conflict(res, "This invitation has expired. Ask for a new one.");
    }

    if (action === "decline") {
      await Invitation.updateOne(
        { _id: invitation._id },
        { $set: { status: "declined", respondedAt: new Date() } }
      );
      return res.json({ success: true, status: "declined" });
    }

    // accept: add to project members (idempotent if already a member)
    await addMemberToProject(invitation, req.user.id);

    await Invitation.updateOne(
      { _id: invitation._id },
      { $set: { status: "accepted", respondedAt: new Date() } }
    );

    events.projectMembers(invitation.project._id, "joined", req.user.id, req.user.id);
    if (invitation.invitedBy && String(invitation.invitedBy) !== String(req.user.id)) {
      events.notifyUser(invitation.invitedBy, {
        actorId: req.user.id,
        actorName: req.user.name,
        type: "member.joined",
        message: `accepted your invitation to “${invitation.project.name}”`,
        projectId: invitation.project._id,
      });
    }

    return res.json({
      success: true,
      status: "accepted",
      project: {
        id: invitation.project._id,
        name: invitation.project.name,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/** Add the user to the project with the invited role (no-op if already in). */
const addMemberToProject = async (invitation, userId) => {
  await Project.updateOne(
    { _id: invitation.project._id, "members.user": { $ne: userId } },
    {
      $push: {
        members: {
          user: userId,
          role: invitation.role,
          joinedAt: new Date(),
        },
      },
    }
  );
};

module.exports = {
  createInvitation,
  listProjectInvitations,
  listMyInvitations,
  revokeInvitation,
  acceptInvitation: respondInvitation("accept"),
  declineInvitation: respondInvitation("decline"),
};
