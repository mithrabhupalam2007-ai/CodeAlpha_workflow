const User = require("../models/User");
const { sendEmail } = require("../utils/sendEmail");
const {
  issueTokenPair,
  clearAuthCookies,
  verifyRefreshToken,
  REFRESH_COOKIE,
} = require("../utils/token");

const GENERIC_AUTH_ERROR = "Invalid email or password.";

/** Shape a user for API responses (password/hash fields are already stripped by toJSON). */
const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
});

// ============================================================
// POST /api/auth/signup
// ============================================================
const signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email }).select("_id");
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists. Try logging in instead.",
        errors: { email: "This email is already registered." },
      });
    }

    const user = await User.create({ name, email, password });
    issueTokenPair(res, user);

    return res.status(201).json({
      success: true,
      message: "Your account has been created.",
      user: publicUser(user),
    });
  } catch (error) {
    // Unique index race (two requests with the same email)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists. Try logging in instead.",
        errors: { email: "This email is already registered." },
      });
    }
    return next(error);
  }
};

// ============================================================
// POST /api/auth/login
// ============================================================
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    // Deliberately identical message for unknown email and wrong password
    // (prevents account enumeration).
    if (!user || !(await user.correctPassword(password))) {
      return res.status(401).json({
        success: false,
        message: GENERIC_AUTH_ERROR,
        errors: { password: GENERIC_AUTH_ERROR },
      });
    }

    issueTokenPair(res, user);

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${user.name.split(" ")[0]}!`,
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================================
// POST /api/auth/logout
// ============================================================
const logout = (req, res) => {
  clearAuthCookies(res);
  res.json({ success: true, message: "You have been logged out." });
};

// ============================================================
// GET /api/auth/me   (protected)
// ============================================================
const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        message: "Your account no longer exists.",
        code: "NOT_AUTHENTICATED",
      });
    }
    return res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
};

// ============================================================
// POST /api/auth/refresh — rotate the token pair
// ============================================================
const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        message: "No active session. Please log in.",
        code: "NOT_AUTHENTICATED",
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        message: "Your session has expired. Please log in again.",
        code: "TOKEN_EXPIRED",
      });
    }

    const user = await User.findById(decoded.sub).select("+tokenVersion");
    if (!user || (user.tokenVersion ?? 0) !== decoded.tv) {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        message: "Your session has expired. Please log in again.",
        code: "TOKEN_EXPIRED",
      });
    }

    issueTokenPair(res, user); // rotates both cookies

    return res.json({
      success: true,
      message: "Session refreshed.",
      user: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================================
// POST /api/auth/forgot-password
// ============================================================
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email }).select(
      "+password +resetPasswordToken +resetPasswordExpires"
    );

    const response = {
      success: true,
      message:
        "If an account exists for that email, a password reset link has been sent.",
    };

    if (user) {
      const rawToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });

      const resetUrl = `${process.env.APP_URL || "http://localhost:5173"}/reset-password?token=${rawToken}`;

      try {
        await sendEmail({
          to: user.email,
          subject: "Reset your WorkFlow password",
          text: `Someone requested a password reset for your WorkFlow account.\n\nReset your password (valid for 10 minutes):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
          html: `<p>Someone requested a password reset for your WorkFlow account.</p><p><a href="${resetUrl}">Reset your password</a> (valid for 10 minutes).</p><p>If you didn't request this, you can safely ignore this email.</p>`,
        });
      } catch (emailError) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save({ validateBeforeSave: false });
        throw emailError;
      }

      // Dev convenience: no SMTP configured → return the link so the flow
      // is testable in the browser. Never included in production.
      if (process.env.NODE_ENV !== "production" && !process.env.SMTP_HOST) {
        response.devResetUrl = resetUrl;
      }
    }

    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

// ============================================================
// POST /api/auth/reset-password
// ============================================================
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const user = await User.findOne({
      resetPasswordToken: User.hashToken(token),
      resetPasswordExpires: { $gt: Date.now() },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has expired. Request a new one.",
        errors: { token: "Invalid or expired reset link." },
      });
    }

    user.password = password; // hashed by the pre-save hook
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1; // kill all existing sessions
    await user.save();

    clearAuthCookies(res);

    return res.json({
      success: true,
      message: "Password updated. You can now log in with your new password.",
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  signup,
  login,
  logout,
  me,
  refresh,
  forgotPassword,
  resetPassword,
};
