const router = require("express").Router();
const { body, param } = require("express-validator");

const requireAuth = require("../middleware/requireAuth");
const validate = require("../middleware/validate");
const {
  listProjects,
  createProject,
  getProject,
  updateProject,
  archiveProject,
  restoreProject,
  deleteProject,
  updateMemberRole,
  removeMember,
} = require("../controllers/project.controller");
const {
  PROJECT_COLORS,
  PROJECT_STATUSES,
  ASSIGNABLE_ROLES,
} = require("../models/Project");

// All project routes require a valid session
router.use(requireAuth);

const idParam = (name) =>
  param(name).isMongoId().withMessage("Invalid id format");

const projectBodyRules = [
  body("name")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Project name must be 2–100 characters"),
  body("description")
    .optional({ nullable: true })
    .isString()
    .isLength({ max: 500 })
    .withMessage("Description must be 500 characters or fewer"),
  body("color")
    .optional()
    .isIn(PROJECT_COLORS)
    .withMessage("Unknown project color"),
  body("dueDate")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("Due date must be a valid date"),
];

// ---------- projects ----------
router.get("/", listProjects);

router.post(
  "/",
  [
    body("name")
      .isString()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Project name must be 2–100 characters"),
    body("description")
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 500 })
      .withMessage("Description must be 500 characters or fewer"),
    body("color")
      .optional()
      .isIn(PROJECT_COLORS)
      .withMessage("Unknown project color"),
    body("dueDate")
      .optional({ nullable: true })
      .isISO8601()
      .withMessage("Due date must be a valid date"),
    body("status")
      .optional()
      .isIn(["active", "on-hold", "completed"])
      .withMessage("Status must be active, on-hold, or completed"),
  ],
  validate,
  createProject
);

router.get("/:id", idParam("id"), validate, getProject);

router.patch(
  "/:id",
  [
    idParam("id"),
    ...projectBodyRules,
    body("status")
      .optional()
      .isIn(["active", "on-hold", "completed"])
      .withMessage("Use the archive/restore actions for archived status"),
  ],
  validate,
  updateProject
);

router.delete("/:id", idParam("id"), validate, deleteProject);

// ---------- archive / restore ----------
router.post("/:id/archive", idParam("id"), validate, archiveProject);
router.post("/:id/restore", idParam("id"), validate, restoreProject);

// ---------- members ----------
router.patch(
  "/:id/members/:userId",
  [
    idParam("id"),
    idParam("userId"),
    body("role")
      .isIn(ASSIGNABLE_ROLES)
      .withMessage(`Role must be one of: ${ASSIGNABLE_ROLES.join(", ")}`),
  ],
  validate,
  updateMemberRole
);

router.delete(
  "/:id/members/:userId",
  [idParam("id"), idParam("userId")],
  validate,
  removeMember
);

module.exports = router;
