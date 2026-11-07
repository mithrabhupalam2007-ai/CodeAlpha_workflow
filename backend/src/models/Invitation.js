const mongoose = require("mongoose");
const crypto = require("crypto");

const INVITATION_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "revoked",
  "expired",
];
// Roles an invitation can grant (never "owner")
const INVITABLE_ROLES = ["admin", "editor", "viewer"];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * An invitation to join a project, sent to an email address.
 *
 * - Only the account whose email matches may accept/decline.
 * - One pending invitation per (project, email).
 * - `expiresAt` is enforced lazily on list/accept (status → "expired").
 */
const invitationSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, "Invitation email is required"],
      lowercase: true,
      trim: true,
      match: [emailRegex, "Please provide a valid email address"],
    },
    role: {
      type: String,
      enum: INVITABLE_ROLES,
      default: "editor",
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomBytes(24).toString("hex"),
    },
    status: {
      type: String,
      enum: INVITATION_STATUSES,
      default: "pending",
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// At most one *pending* invitation per project + email.
invitationSchema.index(
  { project: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);
invitationSchema.index({ email: 1, status: 1, expiresAt: 1 });

module.exports = mongoose.model("Invitation", invitationSchema);
module.exports.INVITATION_STATUSES = INVITATION_STATUSES;
module.exports.INVITABLE_ROLES = INVITABLE_ROLES;
