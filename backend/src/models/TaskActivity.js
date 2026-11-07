const mongoose = require("mongoose");

/**
 * Task activity history — every meaningful change to a task is recorded
 * here (MongoDB). Read-only: rows are created by task controllers and
 * never updated. Lifecycle: cleaned up when the task is deleted.
 * (Distinct from the per-user notification feed in models/Activity.js.)
 */
const ACTIVITY_TYPES = [
  "task-created",
  "task-updated",
  "task-status",
  "task-assigned",
  "task-unassigned",
  "comment-added",
  "comment-edited",
  "comment-deleted",
  "attachment-added",
  "attachment-removed",
];

const activitySchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ACTIVITY_TYPES,
      required: true,
    },
    /** Previous value — old status key or assignee name ("task-status"/"task-assigned"). */
    from: {
      type: String,
      default: null,
      maxlength: 200,
    },
    /** New value — status key, assignee name, or attachment name. */
    to: {
      type: String,
      default: null,
      maxlength: 200,
    },
    /** Human-readable detail (changed fields, first words of a comment…). */
    summary: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

activitySchema.index({ task: 1, createdAt: -1 });

module.exports = mongoose.model("Activity", activitySchema);
module.exports.ACTIVITY_TYPES = ACTIVITY_TYPES;
