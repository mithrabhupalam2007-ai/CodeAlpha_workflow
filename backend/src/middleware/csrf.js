const crypto = require("crypto");

const { CSRF_COOKIE } = require("../utils/token");

/**
 * CSRF protection (double-submit cookie pattern).
 *
 * 1. GET /api/auth/csrf issues a random token in a NON-HTTP-only cookie
 *    (wf_csrf) so JavaScript can read it.
 * 2. The client echoes it back in the X-CSRF-Token header on every
 *    state-changing request (POST/PUT/PATCH/DELETE).
 * 3. The guard compares header vs cookie with a timing-safe compare and
 *    also rejects requests whose Origin header isn't allow-listed.
 *
 * Combined with SameSite cookies this blocks cross-site form posts.
 */

const safeEqual = (a, b) => {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

/** GET /api/auth/csrf — issue (or re-read) the CSRF token. */
const issueCsrf = (req, res) => {
  let token = req.cookies?.[CSRF_COOKIE];

  if (!token) {
    token = crypto.randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // JS must be able to read it
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });
  }

  res.json({ success: true, csrfToken: token });
};

/** Guard for state-changing requests. */
const createCsrfGuard = (allowedOrigins) => (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  // Defense in depth: browsers always send Origin on cross-site POSTs.
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({
      success: false,
      message: "Request origin not allowed.",
    });
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get("x-csrf-token");

  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return res.status(403).json({
      success: false,
      message:
        "Invalid or missing CSRF token. Refresh the page and try again.",
      code: "CSRF_INVALID",
    });
  }

  return next();
};

module.exports = { issueCsrf, createCsrfGuard };
