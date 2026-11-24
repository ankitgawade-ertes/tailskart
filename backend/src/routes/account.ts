import { Router } from "express";
import rateLimit from "express-rate-limit";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env, isTest } from "../config/env.js";
import { HttpError, badRequest, notFound, prisma } from "../lib/core.js";
import { parse } from "../lib/http.js";
import { CUSTOMER_COOKIE, clearSession, issueCustomerSession, optionalCustomer, requireCustomer } from "../lib/auth.js";
import { generateOtp, sendOtp } from "../lib/services.js";
import { productCard } from "../lib/serialize.js";

export const account = Router();

const phoneSchema = z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number");
const hashOtp = (phone: string, code: string) => createHmac("sha256", env.JWT_SECRET).update(`${phone}:${code}`).digest("hex");

const otpLimiter = rateLimit({
  windowMs: 60_000,
  limit: isTest ? 1000 : 6,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many attempts. Please wait a minute and try again." } },
});

const customerOut = (c: { id: string; phone: string; name: string | null; email: string | null; createdAt: Date }) => ({
  id: c.id,
  phone: c.phone,
  name: c.name,
  email: c.email,
  createdAt: c.createdAt,
});

// ---------- Auth ----------

account.post("/auth/otp/request", otpLimiter, async (req, res) => {
  const { phone } = parse(z.object({ phone: phoneSchema }), req.body);
  const recent = await prisma.otpCode.count({ where: { phone, createdAt: { gt: new Date(Date.now() - 36e5) } } });
  if (recent >= env.OTP_MAX_PER_HOUR) throw new HttpError(429, "Too many codes requested. Please try again in an hour.", "rate_limited");
  const code = generateOtp();
  await prisma.otpCode.create({
    data: { phone, codeHash: hashOtp(phone, code), expiresAt: new Date(Date.now() + env.OTP_TTL_SECONDS * 1000), ip: req.ip },
  });
  await sendOtp(phone, code);
  const existing = await prisma.customer.findUnique({ where: { phone }, select: { id: true } });
  res.json({ ok: true, expiresIn: env.OTP_TTL_SECONDS, isNewCustomer: !existing });
});

account.post("/auth/otp/verify", otpLimiter, async (req, res) => {
  const body = parse(
    z.object({
      phone: phoneSchema,
      code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
      name: z.string().trim().min(1).max(80).optional(),
      email: z.string().trim().email().max(120).optional().or(z.literal("")),
    }),
    req.body,
  );
  const otp = await prisma.otpCode.findFirst({
    where: { phone: body.phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) throw badRequest("This code has expired. Please request a new one.", "otp_expired");
  if (otp.attempts >= 5) throw badRequest("Too many wrong attempts. Please request a new code.", "otp_locked");
  const ok = timingSafeEqual(Buffer.from(otp.codeHash), Buffer.from(hashOtp(body.phone, body.code)));
  if (!ok) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw badRequest("That code isn't right. Please check and try again.", "otp_invalid");
  }
  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

  const existing = await prisma.customer.findUnique({ where: { phone: body.phone } });
  if (existing?.isBlocked) throw new HttpError(403, "Your account has been suspended. Please contact support.", "blocked");
  const customer = existing
    ? await prisma.customer.update({
        where: { id: existing.id },
        data: { lastLoginAt: new Date(), ...(!existing.name && body.name ? { name: body.name } : {}), ...(!existing.email && body.email ? { email: body.email } : {}) },
      })
    : await prisma.customer.create({ data: { phone: body.phone, name: body.name, email: body.email || null, lastLoginAt: new Date() } });

  issueCustomerSession(res, customer.id);
  res.json({ customer: customerOut(customer), isNew: !existing });
});

account.get("/auth/me", optionalCustomer, async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!req.customerId) return res.json({ customer: null });
  const c = await prisma.customer.findUnique({ where: { id: req.customerId } });
  if (!c || c.isBlocked) {
    clearSession(res, CUSTOMER_COOKIE);
    return res.json({ customer: null });
  }
  res.json({ customer: customerOut(c) });
});

account.post("/auth/logout", (_req, res) => {
  clearSession(res, CUSTOMER_COOKIE);
  res.json({ ok: true });
});

// ---------- Profile ----------

account.patch("/me", requireCustomer, async (req, res) => {
  const body = parse(
    z.object({ name: z.string().trim().min(1).max(80).optional(), email: z.string().trim().email().max(120).nullable().optional().or(z.literal("")) }),
    req.body,
  );
  const c = await prisma.customer.update({
    where: { id: req.customerId },
    data: { ...(body.name ? { name: body.name } : {}), ...(body.email !== undefined ? { email: body.email || null } : {}) },
  });
  res.json({ customer: customerOut(c) });
});

account.get("/me/summary", requireCustomer, async (req, res) => {
  const [orders, pets, wishlist] = await Promise.all([
    prisma.order.count({ where: { customerId: req.customerId, status: { not: "PENDING_PAYMENT" } } }),
    prisma.petProfile.count({ where: { customerId: req.customerId } }),
    prisma.wishlistItem.count({ where: { customerId: req.customerId } }),
  ]);
  res.json({ orders, pets, wishlist });
});

// ---------- Addresses ----------

const addressSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: phoneSchema,
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode"),
  label: z.enum(["Home", "Work", "Other"]).default("Home"),
  isDefault: z.boolean().optional(),
});

account.get("/me/addresses", requireCustomer, async (req, res) => {
  const items = await prisma.address.findMany({ where: { customerId: req.customerId }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  res.json({ items });
});

account.post("/me/addresses", requireCustomer, async (req, res) => {
  const data = parse(addressSchema, req.body);
  const count = await prisma.address.count({ where: { customerId: req.customerId } });
  if (count >= 20) throw badRequest("You can save up to 20 addresses");
  const makeDefault = data.isDefault || count === 0;
  const item = await prisma.$transaction(async (tx) => {
    if (makeDefault) await tx.address.updateMany({ where: { customerId: req.customerId }, data: { isDefault: false } });
    return tx.address.create({ data: { ...data, isDefault: makeDefault, customerId: req.customerId! } });
  });
  res.status(201).json(item);
});

account.put("/me/addresses/:id", requireCustomer, async (req, res) => {
  const data = parse(addressSchema.partial(), req.body);
  const existing = await prisma.address.findFirst({ where: { id: String(req.params.id), customerId: req.customerId } });
  if (!existing) throw notFound("Address not found");
  const item = await prisma.$transaction(async (tx) => {
    if (data.isDefault) await tx.address.updateMany({ where: { customerId: req.customerId }, data: { isDefault: false } });
    return tx.address.update({ where: { id: existing.id }, data });
  });
  res.json(item);
});

account.delete("/me/addresses/:id", requireCustomer, async (req, res) => {
  const r = await prisma.address.deleteMany({ where: { id: String(req.params.id), customerId: req.customerId } });
  if (!r.count) throw notFound("Address not found");
  res.status(204).end();
});

// ---------- Pet profiles ----------

const petSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(["Dog", "Cat", "Other"]),
  breed: z.string().trim().max(60).optional().nullable(),
  birthday: z.coerce.date().optional().nullable(),
});

account.get("/me/pets", requireCustomer, async (req, res) => {
  res.json({ items: await prisma.petProfile.findMany({ where: { customerId: req.customerId }, orderBy: { createdAt: "asc" } }) });
});

account.post("/me/pets", requireCustomer, async (req, res) => {
  const data = parse(petSchema, req.body);
  if ((await prisma.petProfile.count({ where: { customerId: req.customerId } })) >= 20) throw badRequest("You can add up to 20 pets");
  res.status(201).json(await prisma.petProfile.create({ data: { ...data, customerId: req.customerId! } }));
});

account.delete("/me/pets/:id", requireCustomer, async (req, res) => {
  const r = await prisma.petProfile.deleteMany({ where: { id: String(req.params.id), customerId: req.customerId } });
  if (!r.count) throw notFound("Pet not found");
  res.status(204).end();
});

// ---------- Wishlist ----------

account.get("/me/wishlist", requireCustomer, async (req, res) => {
  const rows = await prisma.wishlistItem.findMany({
    where: { customerId: req.customerId, product: { status: "ACTIVE" } },
    orderBy: { createdAt: "desc" },
    include: { product: { include: { variants: true, images: true, category: true } } },
  });
  res.json({ ids: rows.map((r) => r.productId), items: rows.map((r) => productCard(r.product)) });
});

account.put("/me/wishlist/:productId", requireCustomer, async (req, res) => {
  const p = await prisma.product.findUnique({ where: { id: String(req.params.productId) }, select: { id: true } });
  if (!p) throw notFound("Product not found");
  await prisma.wishlistItem.upsert({
    where: { customerId_productId: { customerId: req.customerId!, productId: p.id } },
    create: { customerId: req.customerId!, productId: p.id },
    update: {},
  });
  res.status(204).end();
});

account.delete("/me/wishlist/:productId", requireCustomer, async (req, res) => {
  await prisma.wishlistItem.deleteMany({ where: { customerId: req.customerId, productId: String(req.params.productId) } });
  res.status(204).end();
});
