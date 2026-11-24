import { PrismaClient } from "@prisma/client";
import pino from "pino";
import { env, isProd, isTest } from "../config/env.js";

export const logger = pino({
  level: isTest ? "silent" : process.env.LOG_LEVEL ?? "info",
  redact: ["req.headers.authorization", "req.headers.cookie", "res.headers['set-cookie']"],
  // Pretty logs only for local development; containers always log JSON (CloudWatch-friendly).
  ...(isProd || isTest || process.env.LOG_FORMAT === "json"
    ? {}
    : { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } } }),
});

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: isProd ? ["error"] : ["error", "warn"] });
if (!isProd) globalForPrisma.prisma = prisma;

/** Error with an HTTP status that is safe to show to clients. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, code = "bad_request", details?: unknown) => new HttpError(400, msg, code, details);
export const unauthorized = (msg = "Please log in to continue") => new HttpError(401, msg, "unauthorized");
export const forbidden = (msg = "You don't have access to this") => new HttpError(403, msg, "forbidden");
export const notFound = (msg = "Not found") => new HttpError(404, msg, "not_found");
export const conflict = (msg: string, code = "conflict") => new HttpError(409, msg, code);

export const orderNumber = (seq: number) => `TK${100000 + seq}`;
export const parseOrderNumber = (num: string) => {
  const m = /^TK(\d{6,})$/i.exec(num.trim());
  return m ? Number(m[1]) - 100000 : null;
};

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);

export const PET_TO_API = { DOG: "dog", CAT: "cat", SMALL: "small", PARENT: "parent" } as const;
export const PET_FROM_API = { dog: "DOG", cat: "CAT", small: "SMALL", parent: "PARENT" } as const;

export { env };
