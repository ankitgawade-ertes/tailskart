import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodSchema, type z } from "zod";
import { corsOrigins, isProd } from "../config/env.js";
import { HttpError, badRequest, logger } from "./core.js";

/** Parse and validate input; throws a 400 with field errors. */
export function parse<S extends ZodSchema>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const fields = r.error.flatten().fieldErrors;
    const first = r.error.issues[0];
    throw badRequest(first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input", "validation_error", fields);
  }
  return r.data;
}

/**
 * CSRF defence for cookie-authenticated requests: state-changing requests must come
 * from an allowed browser origin (or carry no Origin, e.g. server-to-server / webhooks).
 */
export function originGuard(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (origin && !corsOrigins.includes(origin)) throw new HttpError(403, "Request origin not allowed", "bad_origin");
  next();
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, `No route for ${req.method} ${req.path}`, "not_found"));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { code: "validation_error", message: "Invalid input", details: err.flatten().fieldErrors } });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return res.status(409).json({ error: { code: "duplicate", message: `A record with this ${(err.meta?.target as string[])?.join(", ") ?? "value"} already exists` } });
    if (err.code === "P2025") return res.status(404).json({ error: { code: "not_found", message: "Not found" } });
  }
  const e = err as { type?: string; status?: number; message?: string };
  if (e?.type === "entity.parse.failed") return res.status(400).json({ error: { code: "bad_json", message: "Malformed JSON body" } });
  if (e?.type === "entity.too.large") return res.status(413).json({ error: { code: "too_large", message: "Request body too large" } });
  if ((err as { code?: string })?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: { code: "too_large", message: "File is too large" } });

  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  res.status(500).json({ error: { code: "internal", message: isProd ? "Something went wrong. Please try again." : String(e?.message ?? err) } });
}

export const pageParams = (q: Record<string, unknown>, maxLimit = 60) => {
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(q.limit) || 24));
  return { page, limit, skip: (page - 1) * limit };
};
