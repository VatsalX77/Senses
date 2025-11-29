// backend/config/multer.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "..", "uploads");

// ensure upload dir exists
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// filename: <timestamp>-<random>-origname
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`;
    cb(null, name);
  }
});

// file filter (images for profile, pdf/images for certs)
const fileFilter = (allowedTypes = []) => (req, file, cb) => {
  if (!allowedTypes.length) return cb(null, true);
  const ok = allowedTypes.some((t) => file.mimetype.startsWith(t));
  cb(ok ? null : new Error("Invalid file type"), ok);
};

const maxSizeBytes = 5 * 1024 * 1024; // 5 MB default

const makeUploader = ({ types = ["image"], maxSize = maxSizeBytes } = {}) => {
  return multer({
    storage,
    fileFilter: fileFilter(types),
    limits: { fileSize: maxSize }
  });
};

module.exports = { makeUploader, uploadDir };
