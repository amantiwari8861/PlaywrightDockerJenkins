import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

const uploadDir = "uploads";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const filename = `${Date.now()}-${crypto.randomUUID()}${extension}`;

    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // Must be a MulterError so the route-level error handler recognises it.
    const error = new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname);
    error.message = `Only JPEG, PNG and WebP images are allowed (received ${file.mimetype})`;
    cb(error);
  }
};

const upload = multer({
  storage,

  fileFilter,

  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 5,
  },
});

export default upload;

// upload.single("image");
// upload.array("images", 5)

// req.file;   // single file
// req.files;  // multiple files
// req.body;   // text fields
