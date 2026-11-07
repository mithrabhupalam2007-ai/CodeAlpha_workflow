const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

const multer = require("multer");

/**
 * Task attachment uploads (multipart/form-data).
 *
 * Files are stored on disk under backend/uploads with unguessable random
 * names; the URL stored on the task is `/uploads/<file>` and is served
 * statically by app.js. The unguessable name is the access control —
 * URLs only ever appear on tasks whose members can already read them.
 */

/** backend/uploads — created on boot if missing. */
const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

/** Extensions we accept. No HTML/SVG/JS — they can execute in-browser. */
const ALLOWED_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
  ".pdf", ".txt", ".csv", ".md", ".log", ".json",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".zip", ".gz", ".rar", ".7z",
  ".mp3", ".wav", ".mp4", ".mov", ".webm",
]);

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/** Keep just a short, safe extension from the original filename. */
const safeExtension = (originalName) => {
  const ext = path.extname(originalName || "").toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) ? ext : "";
};

/** Display name (basename, control characters stripped, sane length). */
const safeBasename = (originalName, maxLength = 100) => {
  const base = path
    .basename(originalName ?? "")
    .replace(/[\\/:*?"<>|\r\n]+/g, " ")
    .trim();
  return base.slice(0, maxLength);
};

// Files with an unlisted extension are not stored: req.file stays
// undefined and stays silent — the upload controller answers 400.
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      cb(null, `${crypto.randomBytes(16).toString("hex")}${safeExtension(file.originalname)}`);
    },  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) =>
    cb(null, ALLOWED_EXTENSIONS.has(safeExtension(file.originalname))),
});

module.exports = { upload, UPLOAD_DIR, MAX_UPLOAD_BYTES, safeBasename };
