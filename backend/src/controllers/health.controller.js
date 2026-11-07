const mongoose = require("mongoose");
const pkg = require("../../package.json");

const DB_STATES = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

/**
 * GET /api/health
 * Lightweight health check used by the frontend to verify
 * the API + database connection.
 */
const getHealth = (req, res) => {
  const dbState = DB_STATES[mongoose.connection.readyState] || "unknown";

  res.status(200).json({
    success: true,
    status: "OK",
    message: "WorkFlow API is healthy",
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    version: pkg.version,
    database: {
      state: dbState,
      name: mongoose.connection.name || null,
      host: mongoose.connection.host || null,
    },
    realtime: {
      socketIO: Boolean(req.app.get("io")),
    },
  });
};

module.exports = { getHealth };
