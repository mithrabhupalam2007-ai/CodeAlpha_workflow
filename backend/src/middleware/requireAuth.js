const {
  ACCESS_COOKIE,
  verifyAccessToken,
} = require("../utils/token");

/**
 * Protects routes: requires a valid access token
 * (HTTP-only cookie `wf_at`, or an Authorization: Bearer header).
 * On success attaches the decoded identity to req.user.
 */
const requireAuth = (req, res, next) => {
  const bearer = req.headers.authorization;
  const token =
    req.cookies?.[ACCESS_COOKIE] ||
    (bearer?.startsWith("Bearer ") ? bearer.slice(7) : null);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
      code: "NOT_AUTHENTICATED",
    });
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      id: decoded.sub,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
    };
    return next();
  } catch (error) {
    const expired = error.name === "TokenExpiredError";
    return res.status(401).json({
      success: false,
      message: expired
        ? "Your session has expired. Please log in again."
        : "Your session is invalid. Please log in again.",
      code: expired ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
    });
  }
};

module.exports = requireAuth;
