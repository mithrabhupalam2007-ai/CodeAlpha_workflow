/**
 * WorkFlow API entrypoint.
 * 1. Load environment variables
 * 2. Connect to MongoDB (server still starts if DB is down)
 * 3. Create the HTTP server + attach Socket.IO
 * 4. Listen on PORT
 */
require("dotenv").config();

const http = require("http");
const mongoose = require("mongoose");

const app = require("./app");
const { connectDB, disconnectDB } = require("./config/db");
const { initSocket } = require("./sockets/socket");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const server = http.createServer(app);
  const io = initSocket(server);
  app.set("io", io); // make io reachable from controllers: req.app.get("io")

  server.listen(PORT, () => {
    console.log("──────────────────────────────────────────────");
    console.log(`  WorkFlow API  →  http://localhost:${PORT}`);
    console.log(`  Health check  →  http://localhost:${PORT}/api/health`);
    console.log(`  Environment   →  ${process.env.NODE_ENV || "development"}`);
    console.log("──────────────────────────────────────────────");
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use. Change PORT in backend/.env.`);
    } else {
      console.error("Server error:", error.message);
    }
    process.exit(1);
  });
};

// ---------- Graceful shutdown ----------
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  try {
    await disconnectDB();
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
