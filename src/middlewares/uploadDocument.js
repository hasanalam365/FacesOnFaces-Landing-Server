const multer = require("multer");
const path = require("path");

const ALLOWED_MIMETYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
    return cb(
      new Error("Invalid file type. Only JPG, PNG, and PDF are allowed."),
      false
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter,
});

// Exports a middleware that accepts frontFile (required) + backFile (optional)
const uploadDocumentFields = upload.fields([
  { name: "frontFile", maxCount: 1 },
  { name: "backFile", maxCount: 1 },
]);

// Wraps multer to return friendly error messages
const handleDocumentUpload = (req, res, next) => {
  uploadDocumentFields(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File too large. Maximum size is 10MB." });
      }
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

module.exports = handleDocumentUpload;