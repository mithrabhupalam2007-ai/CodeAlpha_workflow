const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [60, "Name must be 60 characters or fewer"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [emailRegex, "Please provide a valid email address"],
    },
    // Hashed only — never stored in plaintext, never selected by default.
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: ["member", "admin"],
      default: "member",
    },
    // Bumped on password reset so every existing session/refresh token dies.
    tokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        // Never expose password hashes or internal auth fields.
        delete ret.password;
        delete ret.tokenVersion;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ---------- Password hashing ----------
// Mongoose 9 async hooks are promise-based — no `next` callback.
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const rounds = Number(process.env.BCRYPT_ROUNDS) || 12;
  this.password = await bcrypt.hash(this.password, rounds);
});

/** Compare a candidate password against the stored hash. */
userSchema.methods.correctPassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Generate a single-use reset token.
 * Returns the raw token (sent to the user by email) and stores only
 * its SHA-256 hash in the database.
 */
userSchema.methods.createPasswordResetToken = function () {
  const rawToken = crypto.randomBytes(32).toString("hex");
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return rawToken;
};

/** Hash a raw token the same way, for lookups. */
userSchema.statics.hashToken = function (rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
};

module.exports = mongoose.model("User", userSchema);
