const mongoose = require("mongoose");

const PROJECT_COLORS = ["indigo", "blue", "emerald", "amber", "rose", "sky"];
const PROJECT_STATUSES = ["active", "on-hold", "completed", "archived"];
// owner > admin > editor > viewer (rank order matters for permission checks)
const PROJECT_ROLES = ["owner", "admin", "editor", "viewer"];
// Roles that can be assigned to invited members (owner is implied by creation)
const ASSIGNABLE_ROLES = ["admin", "editor", "viewer"];

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: PROJECT_ROLES,
      default: "viewer",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
      minlength: [2, "Project name must be at least 2 characters"],
      maxlength: [100, "Project name must be 100 characters or fewer"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description must be 500 characters or fewer"],
      default: "",
    },
    color: {
      type: String,
      enum: PROJECT_COLORS,
      default: "indigo",
    },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: "active",
    },
    dueDate: {
      type: Date,
      default: null,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Membership + role per member. The owner is always present with role "owner".
    members: {
      type: [memberSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// A user is always a member of their own project.
// (Mongoose 9 async/promise-style hooks — no `next` callback.)
projectSchema.pre("save", function () {
  if (!this.owner) return;
  const alreadyMember = (this.members || []).some(
    (member) => String(member.user) === String(this.owner)
  );
  if (!alreadyMember) {
    this.members = this.members || [];
    this.members.unshift({ user: this.owner, role: "owner" });
  } else {
    // Owner always holds the owner role even if data drifted.
    const ownerEntry = this.members.find(
      (member) => String(member.user) === String(this.owner)
    );
    if (ownerEntry && ownerEntry.role !== "owner") ownerEntry.role = "owner";
  }
});

projectSchema.index({ owner: 1, status: 1 });
projectSchema.index({ "members.user": 1, status: 1 });

module.exports = mongoose.model("Project", projectSchema);
module.exports.PROJECT_COLORS = PROJECT_COLORS;
module.exports.PROJECT_STATUSES = PROJECT_STATUSES;
module.exports.PROJECT_ROLES = PROJECT_ROLES;
module.exports.ASSIGNABLE_ROLES = ASSIGNABLE_ROLES;
