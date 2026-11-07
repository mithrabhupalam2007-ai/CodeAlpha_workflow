const jwt = require("jsonwebtoken");

/**
 * JWT signing/verification + secure cookie helpers.
 *
 * Two-token strategy:
 *  - Access token  (15 min)  → wf_at, HTTP-only, sent with every API request
 *  - Refresh token (7 days)  → wf_rt, HTTP-only, rotated on every /auth/refresh
 *  - CSRF token               → wf_csrf, readable by JS (double-submit pattern)
 */

const ACCESS_COOKIE = "wf_at";
const REFRESH_COOKIE = "wf_rt";
const CSRF_COOKIE = "wf_csrf";

const ACCESS_SECRET = () =>
  process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-me";
const REFRESH_SECRET = () =>
  process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-me";

const ACCESS_TTL = () => process.env.JWT_ACCESS_TTL || "15m";
const REFRESH_TTL = () => process.env.JWT_REFRESH_TTL || "7d";

/** Cookie flags. Secure + SameSite=None only in production (HTTPS). */
const baseCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
});

const ttlToMs = (ttl) => {
  const match = /^(\d+)([smhd])$/.exec(String(ttl));
  if (!match) return 15 * 60 * 1000;
  const n = Number(match[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  return n * unit;
};

// ---------- Tokens ----------
const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      type: "access",
      name: user.name,
      email: user.email,
      role: user.role,
    },
    ACCESS_SECRET(),
    { expiresIn: ACCESS_TTL() }
  );

const signRefreshToken = (user) =>
  jwt.sign(
    { sub: user.id, type: "refresh", tv: user.tokenVersion ?? 0 },
    REFRESH_SECRET(),
    { expiresIn: REFRESH_TTL() }
  );

const verifyAccessToken = (token) => {
  const decoded = jwt.verify(token, ACCESS_SECRET());
  if (decoded.type !== "access") throw new Error("Invalid token type");
  return decoded;
};

const verifyRefreshToken = (token) => {
  const decoded = jwt.verify(token, REFRESH_SECRET());
  if (decoded.type !== "refresh") throw new Error("Invalid token type");
  return decoded;
};

// ---------- Cookies ----------
const setAuthCookies = (res, { accessToken, refreshToken }) => {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookieOptions(),
    maxAge: ttlToMs(ACCESS_TTL()),
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    maxAge: ttlToMs(REFRESH_TTL()),
  });
};

const clearAuthCookies = (res) => {
  const opts = { ...baseCookieOptions() };
  res.clearCookie(ACCESS_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, opts);
};

/** Issue a fresh access+refresh pair for a user and set the cookies. */
const issueTokenPair = (res, user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  setAuthCookies(res, { accessToken, refreshToken });
  return { accessToken, refreshToken };
};

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  issueTokenPair,
};
