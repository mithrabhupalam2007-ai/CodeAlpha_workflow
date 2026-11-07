const mongoose = require("mongoose");

const TASK_STATUSES = ["todo", "in-progress", "in-review", "done"];
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"];
const MAX_LABELS = 10;
const MAX_SUBTASKS = 50;
const MAX_ATTACHMENTS = 20;
const MAX_COMMENTS = 100;

const subtaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Subtask title is required"],
      trim: true,
      minlength: [2, "Subtask title must be at least 2 characters"],
      maxlength: [100, "Subtask title must be 100 characters or fewer"],
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true, _id: true }
);

const attachmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: [100, "Attachment name must be 100 characters or fewer"],
      default: "",
    },
    url: {
      type: String,
      required: [true, "Attachment URL is required"],
      trim: true,
      maxlength: [500, "Attachment URL must be 500 characters or fewer"],
      validate: {
        validator: (value) =>
          /^https?:\/\/\S+$/i.test(value) || // outbound link
          /^\/uploads\/[A-Za-z0-9-._~]+(?:\/[A-Za-z0-9-._~]+)*$/.test(value), // uploaded file
        message: "Attachment must be an http(s) URL or an uploaded file path",
      },
    },
    /** Uploaded file size in bytes (null for link attachments). */
    size: {
      type: Number,
      default: null,
      min: 0,
    },
    /** Uploaded file MIME type (null for link attachments). */
    type: {
      type: String,
      default: null,
      maxlength: [120, "Attachment type is too long"],
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true, _id: true }
);

const commentSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, "Comment text is required"],
      trim: true,
      minlength: [1, "Comment text is required"],
      maxlength: [2000, "Comment must be 2000 characters or fewer"],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    /**
     * Threaded replies: set for replies, pointing at the top-level comment
     * in this same task's array. One nesting level — replies can't be
     * parents (enforced by the controller).
     */
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    /** non-null = the comment was edited. */
    editedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      minlength: [2, "Task title must be at least 2 characters"],
      maxlength: [200, "Task title must be 200 characters or fewer"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description must be 1000 characters or fewer"],
      default: "",
    },
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: "todo",
      index: true,
    },
    // Board ordering: ascending within (project, status). Assigned by the
    // move endpoint (and at creation) so the Kanban order persists.
    position: {
      type: Number,
      default: 0,
    },
    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      default: "medium",
    },
    startDate: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    labels: {
      type: [String],
      default: [],
      validate: {
        validator: (labels) =>
          labels.length <= MAX_LABELS &&
          labels.every((label) => label.length <= 24),
        message: `At most ${MAX_LABELS} labels, 24 characters each`,
      },
    },
    subtasks: {
      type: [subtaskSchema],
      default: [],
      validate: {
        validator: (subtasks) => subtasks.length <= MAX_SUBTASKS,
        message: `At most ${MAX_SUBTASKS} subtasks per task`,
      },
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
      validate: {
        validator: (attachments) => attachments.length <= MAX_ATTACHMENTS,
        message: `At most ${MAX_ATTACHMENTS} attachments per task`,
      },
    },
    comments: {
      type: [commentSchema],
      default: [],
      validate: {
        validator: (comments) => comments.length <= MAX_COMMENTS,
        message: `At most ${MAX_COMMENTS} comments per task`,
      },
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Keep completedAt in sync with status changes (drives the weekly chart).
taskSchema.pre("save", function () {
  if (!this.isModified("status")) return;
  this.completedAt = this.status === "done" ? new Date() : null;
});

taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ project: 1, status: 1, position: 1 });
taskSchema.index({ dueDate: 1, status: 1 });
taskSchema.index({ assignee: 1, status: 1 });

module.exports = mongoose.model("Task", taskSchema);
module.exports.TASK_STATUSES = TASK_STATUSES;
module.exports.TASK_PRIORITIES = TASK_PRIORITIES;
module.exports.MAX_LABELS = MAX_LABELS;
module.exports.MAX_SUBTASKS = MAX_SUBTASKS;
module.exports.MAX_ATTACHMENTS = MAX_ATTACHMENTS;
module.exports.MAX_COMMENTS = MAX_COMMENTS;
