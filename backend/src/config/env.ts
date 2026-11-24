import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001"),
    COOKIE_DOMAIN: z.string().optional().default(""),
    TRUST_PROXY: z.coerce.number().int().min(0).default(1),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    ADMIN_JWT_SECRET: z.string().min(32, "ADMIN_JWT_SECRET must be at least 32 characters"),
    OTP_PROVIDER: z.enum(["console", "sns", "test"]).default("console"),
    OTP_TTL_SECONDS: z.coerce.number().int().default(300),
    OTP_MAX_PER_HOUR: z.coerce.number().int().default(5),

    PAYMENT_PROVIDER: z.enum(["mock", "razorpay"]).default("mock"),
    RAZORPAY_KEY_ID: z.string().optional().default(""),
    RAZORPAY_KEY_SECRET: z.string().optional().default(""),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(""),
    PENDING_PAYMENT_TTL_MINUTES: z.coerce.number().int().default(30),

    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    PUBLIC_API_URL: z.string().default("http://localhost:4000"),
    S3_BUCKET: z.string().optional().default(""),
    /** Private bucket for prescriptions (never behind the public CDN). */
    PRIVATE_S3_BUCKET: z.string().optional().default(""),
    /** Comma-separated branch names for ametad bookings and pharko pickup. */
    CARE_BRANCHES: z.string().default("Pune — Baner"),
    MEDIA_CDN_URL: z.string().optional().default(""),
    AWS_REGION: z.string().default("ap-south-1"),

    FREE_SHIPPING_MIN: z.coerce.number().int().default(49900),
    SHIPPING_FEE: z.coerce.number().int().default(4900),
    EXPRESS_FEE: z.coerce.number().int().default(4900),
    COD_MIN: z.coerce.number().int().default(29900),
    COD_MAX: z.coerce.number().int().default(500000),
    SAME_DAY_PREFIXES: z.string().default("560"),
    COD_ENABLED: bool.default("true"),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV === "production") {
      if (e.PAYMENT_PROVIDER === "mock")
        ctx.addIssue({ code: "custom", path: ["PAYMENT_PROVIDER"], message: "mock payments are not allowed in production" });
      if (e.OTP_PROVIDER !== "sns")
        ctx.addIssue({ code: "custom", path: ["OTP_PROVIDER"], message: "use sns for OTP delivery in production" });
      if (e.STORAGE_DRIVER === "s3" && !e.PRIVATE_S3_BUCKET)
        ctx.addIssue({ code: "custom", path: ["PRIVATE_S3_BUCKET"], message: "PRIVATE_S3_BUCKET is required for s3 storage (prescriptions)" });
      if (e.STORAGE_DRIVER === "s3" && (!e.S3_BUCKET || !e.MEDIA_CDN_URL))
        ctx.addIssue({ code: "custom", path: ["S3_BUCKET"], message: "S3_BUCKET and MEDIA_CDN_URL are required for s3 storage" });
    }
    if (e.PAYMENT_PROVIDER === "razorpay" && (!e.RAZORPAY_KEY_ID || !e.RAZORPAY_KEY_SECRET))
      ctx.addIssue({ code: "custom", path: ["RAZORPAY_KEY_ID"], message: "Razorpay keys are required when PAYMENT_PROVIDER=razorpay" });
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
export const careBranches = env.CARE_BRANCHES.split(",").map((s) => s.trim()).filter(Boolean);
export const sameDayPrefixes = env.SAME_DAY_PREFIXES.split(",").map((s) => s.trim()).filter(Boolean);
