/**
 * Central error handler.
 * Express 5 forwards rejected async promises here automatically,
 * so controllers can simply throw.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error("Unhandled error:", err);

  const statusCode =
    res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "production"
      ? {}
      : { stack: err.stack }),
  });
};

module.exports = errorHandler;
