import fs from "fs";
import path from "path";
import type { Response } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { Readable } from "stream";
import { env, isR2Configured } from "./env";

/**
 * Storage for uploaded report files, with two backends:
 *  - Cloudflare R2 (or any S3-compatible bucket), used whenever R2_* env
 *    vars are set — this is what actually survives a redeploy on a free
 *    host, since most of them wipe local disk on every deploy.
 *  - Local disk under backend/uploads/reports, used otherwise (zero setup
 *    for local dev, but NOT guaranteed to persist in production).
 *
 * The rest of the app only ever sees an opaque `storagePath` string handed
 * back from `saveReportFile` and passed to `streamReportFile`/
 * `deleteReportFile` — no other module needs to know or care which backend
 * is active.
 */

const UPLOADS_ROOT = path.join(process.cwd(), "uploads", "reports");
if (!isR2Configured) fs.mkdirSync(UPLOADS_ROOT, { recursive: true });

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

// Always buffer in memory rather than writing to disk via multer directly —
// saveReportFile() below is then the single place that decides where the
// bytes actually end up, whichever backend is active.
export const reportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Unsupported file type. Allowed: PDF, JPEG, PNG, WEBP."));
      return;
    }
    cb(null, true);
  },
});

let s3: S3Client | null = null;
function getS3Client(): S3Client {
  if (s3) return s3;
  s3 = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! },
  });
  return s3;
}

/** Uploads a just-received file and returns the opaque storagePath to persist on the Report row. */
export async function saveReportFile(file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname);
  const key = `${randomUUID()}${ext}`;

  if (isR2Configured) {
    await getS3Client().send(
      new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key, Body: file.buffer, ContentType: file.mimetype })
    );
  } else {
    fs.writeFileSync(path.join(UPLOADS_ROOT, key), file.buffer);
  }

  return key;
}

/** Streams a previously-saved report file as a download response. */
export async function streamReportFile(storagePath: string, res: Response, downloadName: string): Promise<void> {
  if (isR2Configured) {
    const obj = await getS3Client().send(new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: storagePath }));
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadName)}"`);
    if (obj.ContentType) res.setHeader("Content-Type", obj.ContentType);
    await new Promise<void>((resolve, reject) => {
      const stream = obj.Body as Readable;
      stream.pipe(res);
      stream.on("end", resolve);
      stream.on("error", reject);
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    res.download(path.join(UPLOADS_ROOT, storagePath), downloadName, (err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Deletes a stored report file. Never throws — the Report row is already
 * deleted from Postgres by the time this runs, so a failed cleanup here
 * only means an orphaned object/file, not an inconsistent app state, same
 * "best-effort, never block the request" posture as publishMqtt().
 */
export async function deleteReportFile(storagePath: string): Promise<void> {
  if (isR2Configured) {
    try {
      await getS3Client().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: storagePath }));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[storage] Failed to delete R2 object ${storagePath}:`, err);
    }
    return;
  }

  fs.unlink(path.join(UPLOADS_ROOT, storagePath), (err) => {
    if (err && err.code !== "ENOENT") {
      // eslint-disable-next-line no-console
      console.error(`[storage] Failed to delete report file ${storagePath}:`, err);
    }
  });
}
