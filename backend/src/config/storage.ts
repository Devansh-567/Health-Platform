import fs from "fs";
import path from "path";
import multer from "multer";
import { randomUUID } from "crypto";

/**
 * Local-disk storage for uploaded reports (dev/small-deployment default).
 * For production, swap this module for an S3-compatible client — the rest
 * of the app only depends on `storagePath` being an opaque string it can
 * hand back to `readReportFile`/`deleteReportFile`, so no other file needs
 * to change.
 */

const UPLOADS_ROOT = path.join(process.cwd(), "uploads", "reports");
fs.mkdirSync(UPLOADS_ROOT, { recursive: true });

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_ROOT),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const reportUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Unsupported file type. Allowed: PDF, JPEG, PNG, WEBP."));
      return;
    }
    cb(null, true);
  },
});

export function reportFileAbsolutePath(storagePath: string) {
  return path.join(UPLOADS_ROOT, storagePath);
}

export function deleteReportFile(storagePath: string) {
  const absPath = reportFileAbsolutePath(storagePath);
  fs.unlink(absPath, (err) => {
    if (err && err.code !== "ENOENT") {
      // eslint-disable-next-line no-console
      console.error(`[storage] Failed to delete report file ${storagePath}:`, err);
    }
  });
}