const { validationResult } = require("express-validator");

/**
 * Run express-validator rules, then reply 400 with per-field messages.
 * Response shape: { success: false, message, errors: { field: "msg" } }
 */
const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = {};
  for (const error of result.array()) {
    const field = error.path || error.param || "form";
    if (!errors[field]) errors[field] = error.msg;
  }

  return res.status(400).json({
    success: false,
    message: "Please fix the highlighted fields.",
    errors,
  });
};

module.exports = validate;
