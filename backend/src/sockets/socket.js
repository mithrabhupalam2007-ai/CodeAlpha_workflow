const { Server } = require("socket.io");
const mongoose = require("mongoose");

const {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  verifyAccessToken,
  verifyRefreshToken,
} = require("../utils/token");
const User = require("../models/User");
const Project = require("../models/Project");
const { getProjectRole } = require("../utils/permissions");

let io = null;

/** Each user gets a private room for instant notifications. */
const userRoom = (userId) => `user:${userId}`;
/** One room per project; membership is verified before every join. */
const projectRoom = (projectId) => `project:${projectId}`;

/** Minimal cookie header parser (no cookie-parser in the ws stack). */
const parseCookieHeader = (header) => {
  const jar = {};
  if (!header) return jar;
  for (const part of String(header).split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    jar[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return jar;
};

/**
 * Handshake authentication — runs BEFORE "connection".
 *
 * Cookies ride along on the same-origin handshake, so no tokens are ever
 * exposed to JavaScript. Accepts either the access token (15 min) or, as a
 * fallback for long-lived sessions, the refresh token — in which case the
 * user is reloaded from MongoDB and their tokenVersion is verified, so a
 * password reset kills realtime sessions too.
 */
const authenticateSocket = async (socket, next) => {
  try {
    const cookies = parseCookieHeader(socket.handshake.headers.cookie);

    let user = null;
    if (cookies[ACCESS_COOKIE]) {
      try {
        const claims = verifyAccessToken(cookies[ACCESS_COOKIE]);
        user = { id: claims.sub, name: claims.name, email: claims.email };
      } catch {
        /* expired access token — fall through to the refresh token */
      }
    }
    if (!user && cookies[REFRESH_COOKIE]) {
      try {
        const claims = verifyRefreshToken(cookies[REFRESH_COOKIE]);
        const doc = await User.findById(claims.sub).select("name email tokenVersion").lean();
        if (doc && (doc.tokenVersion ?? 0) === (claims.tv ?? 0)) {
          user = { id: doc._id, name: doc.name, email: doc.email };
        }
      } catch {
        /* invalid refresh token too */
      }
    }

    if (!user) return next(new Error("unauthorized"));
    socket.data.user = user;
    return next();
  } catch (error) {
    return next(new Error("unauthorized"));
  }
};

/** Verify project membership; resolves the member's role or null. */
const resolveProjectRole = async (userId, projectId) => {
  if (!mongoose.isValidObjectId(projectId)) return null;
  const project = await Project.findById(projectId).select("owner members").lean();
  if (!project) return null;
  return getProjectRole(project, userId) || null;
};

/**
 * Attach Socket.IO to the HTTP server:
 *  - authenticated connections only (JWT cookies on the handshake)
 *  - `user:<id>` room auto-joined for instant notifications
 *  - `room:join` / `room:leave` with membership checks + ack callbacks
 */
const initSocket = (httpServer) => {
  const DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
  const allowedOrigins = process.env.CLIENT_URL
    ? [process.env.CLIENT_URL, ...DEV_ORIGINS]
    : DEV_ORIGINS;

  io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
    transports: ["websocket", "polling"],
    pingTimeout: 20000,
  });

  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const user = socket.data.user;

    // Private notification room — server-managed, survives reconnects.
    socket.join(userRoom(user.id));

    socket.emit("server:hello", {
      message: "Connected to WorkFlow realtime server",
      socketId: socket.id,
      userId: user.id,
      user,
      timestamp: Date.now(),
    });

    /**
     * Join project room(s): `socket.emit("room:join", projectId | projectIds, ack)`.
     * Membership is verified against MongoDB on every join — non-members
     * are refused and rooms are the only path to domain events.
     */
    socket.on("room:join", async (payload, callback) => {
      const ack = typeof callback === "function" ? callback : () => {};

      if (Array.isArray(payload)) {
        const joined = [];
        for (const id of payload) {
          if (mongoose.isValidObjectId(id)) {
            const role = await resolveProjectRole(user.id, id);
            if (role) {
              await socket.join(projectRoom(id));
              joined.push({ projectId: String(id), role, room: projectRoom(id) });
            }
          }
        }
        return ack({ ok: true, joined });
      }

      const projectId = payload;
      if (!mongoose.isValidObjectId(projectId)) {
        return ack({ ok: false, role: null, error: "invalid project id" });
      }
      // Membership verified against MongoDB on every join — non-members
      // are refused and only valid joins reach domain events.
      const role = await resolveProjectRole(user.id, projectId);
      if (!role) {
        return ack({
          ok: false,
          role: null,
          error: "Project not found or you don’t have access to it.",
        });
      }

      await socket.join(projectRoom(projectId));
      return ack({ ok: true, role, room: projectRoom(projectId) });
    });

    // Leaving is always allowed (defensive: only this socket leaves).
    socket.on("room:leave", async (payload, callback) => {
      const ack = typeof callback === "function" ? callback : () => {};
      const ids = Array.isArray(payload) ? payload : [payload];
      for (const id of ids) {
        if (mongoose.isValidObjectId(id)) {
          await socket.leave(projectRoom(id));
        }
      }
      return ack({ ok: true });
    });

    // Latency check
    socket.on("client:ping", (cb) => {
      const payload = { pong: true, timestamp: Date.now() };
      if (typeof cb === "function") cb(payload);
      else socket.emit("server:pong", payload);
    });

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${user.id} ${user.name ?? ""} (${reason})`);
    });
  });

  return io;
};

/** Access the io instance from anywhere (controllers via req.app.get("io")). */
const getIO = () => io;

module.exports = { initSocket, getIO, userRoom, projectRoom };
