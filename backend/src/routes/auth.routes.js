const router = require("express").Router();
const { body } = require("express-validator");

const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const { issueCsrf } = require("../middleware/csrf");

const {
  signup,
  login,
  logout,
  me,
  refresh,
  forgotPassword,
  resetPassword,
} = require("../controllers/auth.controller");

// ---------- Shared validation rules ----------
const emailRules = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Enter a valid email address")
    .normalizeEmail(),
];

const passwordRules = [
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Za-z]/)
    .withMessage("Password must contain at least one letter")
    .matches(/\d/)
    .withMessage("Password must contain at least one number"),
];

const signupRules = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 60 })
    .withMessage("Name must be between 2 and 60 characters"),
  ...emailRules,
  ...passwordRules,
];

const loginRules = [
  ...emailRules,
  body("password").trim().notEmpty().withMessage("Password is required"),
];

const forgotRules = emailRules;

const resetRules = [
  body("token")
    .trim()
    .notEmpty()
    .withMessage("Reset token is required"),
  ...passwordRules,
];

// ---------- Routes ----------
// GET /api/auth/csrf — issue the double-submit CSRF token cookie
router.get("/csrf", issueCsrf);

// POST /api/auth/signup — creates the user and logs them in
router.post("/signup", signupRules, validate, signup);

// POST /api/auth/login
router.post("/login", loginRules, validate, login);

// POST /api/auth/logout — clears both auth cookies
router.post("/logout", logout);

// POST /api/auth/refresh — rotates the access + refresh pair
router.post("/refresh", refresh);

// GET /api/auth/me — protected
router.get("/me", requireAuth, me);

// POST /api/auth/forgot-password
router.post("/forgot-password", forgotRules, validate, forgotPassword);

// POST /api/auth/reset-password
router.post("/reset-password", resetRules, validate, resetPassword);

module.exports = router;
