const router = require("express").Router();
const { body, param, query } = require("express-validator");

const requireAuth = require("../middleware/requireAuth");
const validate = require("../middleware/validate");
const {
  createInvitation,
  listProjectInvitations,
  listMyInvitations,
  revokeInvitation,
  acceptInvitation,
  declineInvitation,
} = require("../controllers/invitation.controller");
const { INVITABLE_ROLES } = require("../models/Invitation");

// All invitation routes require a valid session
router.use(requireAuth);

// My pending invitations (must be declared before /:id routes)
router.get("/mine", listMyInvitations);

// Pending invitations for a project (owner/admin)
router.get(
  "/",
  [query("projectId").isMongoId().withMessage("Invalid project id")],
  validate,
  listProjectInvitations
);

// Invite by email (owner/admin)
router.post(
  "/",
  [
    body("projectId").isMongoId().withMessage("Invalid project id"),
    body("email")
      .isEmail()
      .withMessage("Please provide a valid email address")
      .normalizeEmail(),
    body("role")
      .optional()
      .isIn(INVITABLE_ROLES)
      .withMessage(`Role must be one of: ${INVITABLE_ROLES.join(", ")}`),
  ],
  validate,
  createInvitation
);

router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid invitation id")],
  validate,
  revokeInvitation
);

// The invited user responds
router.post(
  "/:id/accept",
  [param("id").isMongoId().withMessage("Invalid invitation id")],
  validate,
  acceptInvitation
);

router.post(
  "/:id/decline",
  [param("id").isMongoId().withMessage("Invalid invitation id")],
  validate,
  declineInvitation
);

module.exports = router;
