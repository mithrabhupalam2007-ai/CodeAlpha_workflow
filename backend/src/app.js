const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const projectRoutes = require("./routes/project.routes");
const invitationRoutes = require("./routes/invitation.routes");
const taskRoutes = require("./routes/task.routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const { createCsrfGuard } = require("./middleware/csrf");
const { UPLOAD_DIR } = require("./middleware/upload");

const app = express();

const DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL, ...DEV_ORIGINS]
  : DEV_ORIGINS;

// ---------- Global middleware ----------
app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin/non-browser requests (no Origin header) and whitelisted origins
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true, // required for cross-origin cookie auth
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // exposes req.cookies for JWT + CSRF cookies

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ---------- Routes ----------
app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "WorkFlow API",
    version: require("../package.json").version,
    environment: process.env.NODE_ENV || "development",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      dashboard: "/api/dashboard/summary",
      projects: "/api/projects",
      invitations: "/api/invitations",
      tasks: "/api/tasks",
    },
  });
});

// Uploaded task attachments: served with unguessable random file names
// under /uploads/<32-hex><ext>. GET-only, no auth (name = access control).
// fallthrough so deleted/unknown files land in the normal 404 handler.
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "1h" }));

// CSRF guard: every state-changing /api request must echo the wf_csrf
// cookie in the X-CSRF-Token header (skips GET/HEAD/OPTIONS).
app.use("/api", createCsrfGuard(allowedOrigins));

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/health", healthRoutes);

// ---------- 404 + error handling ----------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
