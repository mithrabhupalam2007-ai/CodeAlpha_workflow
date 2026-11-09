const mongoose = require("mongoose");

/**
 * Per-user notification feed — powers the dashboard activity card and the
 * topbar notifications bell (GET /api/dashboard/activity). One row per
 * (user × event) the user should be told about. Realtime delivery of new
 * rows happens over Socket.IO ("notification:new"), but the rows here are
 * the source of truth: clients resync from this collection on load.
 * (Distinct from the per-task audit trail in models/TaskActivity.js.)
 */
const NOTIFICATION_TYPES = [
  "project.created",
  "project.updated",
  "task.created",
  "task.assigned",
  "task.completed",
  "comment.added",
  "member.joined",
  "member.removed",
];

const notificationSchema = new mongoose.Schema(
  {
    /** Recipient — the inbox owner. */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    /** Who caused the event (may equal user for self-actions). */
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    type: {
      type: String,
      maxlength: 40,
      default: "project.updated",
    },
    message: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Activity", notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
