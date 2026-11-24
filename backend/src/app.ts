import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { corsOrigins, env, isTest } from "./config/env.js";
import { logger, prisma } from "./lib/core.js";
import { errorHandler, notFoundHandler, originGuard } from "./lib/http.js";
import { requireAdmin } from "./lib/auth.js";
import { catalog } from "./routes/catalog.js";
import { account } from "./routes/account.js";
import { orders, razorpayWebhook } from "./routes/orders.js";
import { misc } from "./routes/misc.js";
import { adminAuth, adminOps } from "./routes/admin-ops.js";
import { adminCatalog } from "./routes/admin-catalog.js";
import { care } from "./routes/care.js";
import { adminCare } from "./routes/admin-care.js";
import { adminTools } from "./routes/admin-tools.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req.headers["x-request-id"] as string) || randomUUID(),
      autoLogging: { ignore: (req) => req.url === "/health" },
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
    }),
  );
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || corsOrigins.includes("*") || corsOrigins.includes(origin)),
      credentials: true,
      maxAge: 600,
    }),
  );
  app.use(compression());

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", time: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: "db_unavailable" });
    }
  });

  if (env.STORAGE_DRIVER === "local") {
    app.use("/uploads", express.static(resolve(process.cwd(), "uploads"), { maxAge: "7d", immutable: true }));
  }

  // Webhooks need the raw body for signature checks, so they go before the JSON parser.
  app.use("/v1", razorpayWebhook);

  // Spreadsheet imports can be larger than ordinary requests.
  app.use("/v1/admin/products/import", express.json({ limit: "8mb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(
    "/v1",
    rateLimit({
      windowMs: 60_000,
      limit: isTest ? 10_000 : 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: { code: "rate_limited", message: "Too many requests. Please slow down." } },
    }),
  );
  app.use("/v1", originGuard);

  app.use("/v1", catalog, account, orders, misc, care);
  app.use("/v1/admin", adminAuth);
  app.use("/v1/admin", requireAdmin("STAFF"), adminTools, adminOps, adminCatalog, adminCare);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
