const mongoose = require("mongoose");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/workflow";

const READY_STATES = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

/**
 * Connect to MongoDB.
 * The server keeps running even if the database is unavailable,
 * so the /api/health endpoint can report the real connection state.
 */
const connectDB = async () => {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("connected", () => {
    console.log(`MongoDB connected -> ${mongoose.connection.host}/${mongoose.connection.name}`);
  });
  mongoose.connection.on("error", (err) => {
    console.error(`MongoDB error: ${err.message}`);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected");
  });

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    console.error(
      "API will keep running WITHOUT a database. Start MongoDB or fix MONGODB_URI, then restart the server."
    );
  }

  return mongoose.connection;
};

/** Current database connection state as a readable string. */
const getDbState = () =>
  READY_STATES[mongoose.connection.readyState] || "unknown";

/** Gracefully close the mongoose connection (used on shutdown). */
const disconnectDB = async () => {
  await mongoose.connection.close();
  console.log("MongoDB connection closed");
};

module.exports = { connectDB, disconnectDB, getDbState };
