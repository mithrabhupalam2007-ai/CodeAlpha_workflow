const router = require("express").Router();
const { body, param, query } = require("express-validator");

const requireAuth = require("../middleware/requireAuth");
const validate = require("../middleware/validate");
const { upload, MAX_UPLOAD_BYTES } = require("../middleware/upload");
const {
  listTasks,
  getTask,
  createTask,
  updateTask,
  updateTaskStatus,
  moveTask,
  deleteTask,
  addSubtask,
  updateSubtask,
  removeSubtask,
  addAttachment,
  uploadAttachment,
  removeAttachment,
  getTaskActivity,
  addComment,
  editComment,
  removeComment,
} = require("../controllers/task.controller");
const {
  TASK_STATUSES,
  TASK_PRIORITIES,
  MAX_LABELS,
} = require("../models/Task");

// All task routes require a valid session
router.use(requireAuth);

const idParam = (name) => param(name).isMongoId().withMessage("Invalid id format");

/**
 * multer wrapper: turn upload errors (too large, malformed multipart…) into
 * a clean 400 instead of letting them hit the generic error handler (500).
 */
const uploadSingle = (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();
    const mb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
    return res.status(400).json({
      success: false,
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? `Files can be at most ${mb} MB.`
          : "Upload failed — check the file size and type.",
    });
  });
};

const labelRules = [
  body("labels").optional().isArray({ max: MAX_LABELS }).withMessage(`At most ${MAX_LABELS} labels`),
  body("labels.*")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 24 })
    .withMessage("Labels must be 24 characters or fewer"),
];

const dateRules = [
  body("startDate").optional({ nullable: true }).isISO8601().withMessage("Start date must be a valid date"),
  body("dueDate").optional({ nullable: true }).isISO8601().withMessage("Due date must be a valid date"),
];

// ---------- list / search / filter / sort ----------
router.get(
  "/",
  [
    query("projectId").optional().isMongoId().withMessage("Invalid project id"),
    query("status").optional().isIn(TASK_STATUSES).withMessage("Unknown status"),
    query("priority").optional().isIn(TASK_PRIORITIES).withMessage("Unknown priority"),
    query("sort")
      .optional()
      .isIn(["due", "priority", "created", "updated", "title", "position"])
      .withMessage("Unknown sort field"),
    query("order").optional().isIn(["asc", "desc"]).withMessage("Order must be asc or desc"),
  ],
  validate,
  listTasks
);

// ---------- create ----------
router.post(
  "/",
  [
    body("projectId").isMongoId().withMessage("Invalid project id"),
    body("title")
      .isString()
      .trim()
      .isLength({ min: 2, max: 200 })
      .withMessage("Title must be 2–200 characters"),
    body("description")
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 1000 })
      .withMessage("Description must be 1000 characters or fewer"),
    body("priority").optional().isIn(TASK_PRIORITIES).withMessage("Unknown priority"),
    body("status").optional().isIn(TASK_STATUSES).withMessage("Unknown status"),
    body("assignee").optional({ nullable: true }).isMongoId().withMessage("Invalid assignee"),
    ...dateRules,
    ...labelRules,
  ],
  validate,
  createTask
);

// ---------- read ----------
router.get("/:id", idParam("id"), validate, getTask);

// ---------- activity history (any member; newest first) ----------
router.get("/:id/activity", idParam("id"), validate, getTaskActivity);

// ---------- update fields (editor+) ----------
router.patch(
  "/:id",
  [
    idParam("id"),
    body("title").optional().isString().trim().isLength({ min: 2, max: 200 })
      .withMessage("Title must be 2–200 characters"),
    body("description").optional({ nullable: true }).isString().isLength({ max: 1000 })
      .withMessage("Description must be 1000 characters or fewer"),
    body("priority").optional().isIn(TASK_PRIORITIES).withMessage("Unknown priority"),
    body("assignee").optional({ nullable: true }).isMongoId().withMessage("Invalid assignee"),
    ...dateRules,
    ...labelRules,
  ],
  validate,
  updateTask
);

// ---------- status (editor+ or assignee) ----------
router.patch(
  "/:id/status",
  [
    idParam("id"),
    body("status").isIn(TASK_STATUSES).withMessage("Unknown status"),
  ],
  validate,
  updateTaskStatus
);

// ---------- kanban move: column + ordering (editor+ or assignee) ----------
router.patch(
  "/:id/move",
  [
    idParam("id"),
    body("status").optional().isIn(TASK_STATUSES).withMessage("Unknown status"),
    body("orderedIds")
      .optional()
      .isArray({ max: 500 })
      .withMessage("orderedIds must be an array of up to 500 ids"),
    body("orderedIds.*").optional().isMongoId().withMessage("Invalid task id in orderedIds"),
  ],
  validate,
  moveTask
);

router.delete("/:id", idParam("id"), validate, deleteTask);

// ---------- subtasks (editor+ or assignee) ----------
router.post(
  "/:id/subtasks",
  [
    idParam("id"),
    body("title")
      .isString()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Subtask title must be 2–100 characters"),
  ],
  validate,
  addSubtask
);

router.patch(
  "/:id/subtasks/:subId",
  [
    idParam("id"),
    idParam("subId"),
    body("completed").optional().isBoolean().withMessage("completed must be a boolean"),
    body("title").optional().isString().trim().isLength({ min: 2, max: 100 })
      .withMessage("Subtask title must be 2–100 characters"),
  ],
  validate,
  updateSubtask
);

router.delete(
  "/:id/subtasks/:subId",
  [idParam("id"), idParam("subId")],
  validate,
  removeSubtask
);

// ---------- attachments (links + uploaded files) ----------
router.post(
  "/:id/attachments",
  [
    idParam("id"),
    body("url")
      .isURL({ protocols: ["http", "https"], require_protocol: true })
      .withMessage("Please provide a valid http(s) URL"),
    body("name").optional().isString().trim().isLength({ max: 100 })
      .withMessage("Name must be 100 characters or fewer"),
  ],
  validate,
  addAttachment
);

// Multipart file upload (editor+ or the task's assignee; 8 MB cap,
// extension-allowlisted — see middleware/upload.js)
router.post(
  "/:id/attachments/upload",
  [idParam("id")],
  uploadSingle,
  validate,
  uploadAttachment
);

router.delete(
  "/:id/attachments/:attachmentId",
  [idParam("id"), idParam("attachmentId")],
  validate,
  removeAttachment
);

// ---------- comments ----------
// Any member adds (incl. viewers) + replies via parentId;
// only the author edits; author or editor+ deletes.
router.post(
  "/:id/comments",
  [
    idParam("id"),
    body("text")
      .isString()
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage("Comment must be 1–2000 characters"),
    body("parentId").optional({ nullable: true }).isMongoId().withMessage("Invalid reply target"),
  ],
  validate,
  addComment
);

// Edit own comment only (authorization enforced in the controller).
router.patch(
  "/:id/comments/:commentId",
  [
    idParam("id"),
    idParam("commentId"),
    body("text")
      .isString()
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage("Comment must be 1–2000 characters"),
  ],
  validate,
  editComment
);

router.delete(
  "/:id/comments/:commentId",
  [idParam("id"), idParam("commentId")],
  validate,
  removeComment
);

module.exports = router;
