import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ApiError } from "../utils/ApiError";
import { logger } from "../config/logger";
import { isProd } from "../config/env";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, code: "ROUTE_NOT_FOUND", message: `No route: ${req.method} ${req.path}` });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ success: false, code: err.code, message: err.message, details: err.details });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Invalid input", details: err.flatten() });
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File is too large (max 15MB)" : err.message;
    return res.status(400).json({ success: false, code: "UPLOAD_ERROR", message });
  }
  // Our custom fileFilter in config/storage.ts rejects unsupported types by
  // calling cb(new Error(...)) — multer surfaces that as a plain Error, not
  // a MulterError, so it needs its own check here.
  if (err instanceof Error && err.message.startsWith("Unsupported file type")) {
    return res.status(400).json({ success: false, code: "UPLOAD_ERROR", message: err.message });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ success: false, code: "DUPLICATE_ENTRY", message: `Duplicate value for ${err.meta?.target}` });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Record not found" });
    }
  }

  logger.error({ err, path: req.path }, "Unhandled error");
  return res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message: isProd ? "Something went wrong" : (err as Error)?.message,
  });
}