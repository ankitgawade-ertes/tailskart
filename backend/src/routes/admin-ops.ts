import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import type { OrderStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { isTest } from "../config/env.js";
import { HttpError, badRequest, notFound, orderNumber, parseOrderNumber, prisma, unauthorized } from "../lib/core.js";
import { pageParams, parse } from "../lib/http.js";
import { ADMIN_COOKIE, clearSession, issueAdminSession, requireAdmin } from "../lib/auth.js";
import { cancelOrder, orderInclude } from "../lib/orders.js";
import { orderOut } from "../lib/serialize.js";
import { awardOrderPoints, ensureReferralCode, grantPoints, reverseOrderPoints } from "../lib/loyalty.js";
import { getSettings, tierFor } from "../lib/settings.js";

export const adminOps = Router();
/** Login/logout/me — mounted without the admin guard. */
export const adminAuth = Router();

const adminOut = (a: { id: string; email: string; name: string; role: string; isActive: boolean; lastLoginAt: Date | null; createdAt: Date }) => ({
  id: a.id,
  email: a.email,
  name: a.name,
  role: a.role,
  isActive: a.isActive,
  lastLoginAt: a.lastLoginAt,
  createdAt: a.createdAt,
});

// ---------- Auth ----------

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: isTest ? 1000 : 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many login attempts. Try again in 15 minutes." } },
});

adminAuth.post("/auth/login", loginLimiter, async (req, res) => {
  const { email, password } = parse(z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) }), req.body);
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  // Always run bcrypt to keep timing similar for unknown emails.
  const ok = await bcrypt.compare(password, admin?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali");
  if (!admin || !ok || !admin.isActive) throw unauthorized("Incorrect email or password");
  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  issueAdminSession(res, admin);
  res.json({ admin: adminOut(admin) });
});

adminAuth.post("/auth/logout", (_req, res) => {
  clearSession(res, ADMIN_COOKIE);
  res.json({ ok: true });
});

adminAuth.get("/auth/me", requireAdmin(), async (req, res) => {
  const a = await prisma.adminUser.findUniqueOrThrow({ where: { id: req.admin!.id } });
  res.set("Cache-Control", "no-store").json({ admin: adminOut(a) });
});

const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Use letters and numbers");

adminAuth.post("/auth/password", requireAdmin(), async (req, res) => {
  const { current, next } = parse(z.object({ current: z.string(), next: passwordSchema }), req.body);
  const a = await prisma.adminUser.findUniqueOrThrow({ where: { id: req.admin!.id } });
  if (!(await bcrypt.compare(current, a.passwordHash))) throw badRequest("Current password is incorrect");
  await prisma.adminUser.update({ where: { id: a.id }, data: { passwordHash: await bcrypt.hash(next, 12) } });
  res.json({ ok: true });
});


// ---------- Dashboard ----------

const REVENUE_STATUSES: OrderStatus[] = ["PLACED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

adminOps.get("/dashboard", async (_req, res) => {
  const day = 864e5;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const since = (d: number) => new Date(startOfToday.getTime() - d * day);
  const revenue = async (from: Date) =>
    prisma.order.aggregate({ where: { status: { in: REVENUE_STATUSES }, placedAt: { gte: from } }, _sum: { total: true }, _count: true });

  const [today, week, month, byStatus, newCustomers, lowStock, recent, last14, topItems] = await Promise.all([
    revenue(startOfToday),
    revenue(since(6)),
    revenue(since(29)),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.customer.count({ where: { createdAt: { gte: since(29) } } }),
    prisma.variant.findMany({
      where: { stock: { lte: 5 }, isActive: true, product: { status: "ACTIVE" } },
      orderBy: { stock: "asc" },
      take: 10,
      include: { product: { select: { id: true, name: true, brand: true } } },
    }),
    prisma.order.findMany({
      where: { status: { not: "PENDING_PAYMENT" } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { customer: { select: { name: true, phone: true } } },
    }),
    prisma.order.findMany({ where: { status: { in: REVENUE_STATUSES }, placedAt: { gte: since(13) } }, select: { total: true, placedAt: true } }),
    prisma.orderItem.groupBy({
      by: ["productId", "name", "brand"],
      where: { order: { status: { in: REVENUE_STATUSES }, placedAt: { gte: since(29) } } },
      _sum: { qty: true, price: true },
      orderBy: { _sum: { qty: "desc" } },
      take: 5,
    }),
  ]);

  const series = Array.from({ length: 14 }, (_, i) => {
    const d = since(13 - i);
    const next = new Date(d.getTime() + day);
    const rows = last14.filter((o) => o.placedAt! >= d && o.placedAt! < next);
    return { date: d.toISOString().slice(0, 10), revenue: rows.reduce((s, o) => s + o.total, 0), orders: rows.length };
  });

  res.json({
    revenue: {
      today: { total: today._sum.total ?? 0, orders: today._count },
      week: { total: week._sum.total ?? 0, orders: week._count },
      month: { total: month._sum.total ?? 0, orders: month._count },
    },
    statusCounts: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    newCustomers,
    lowStock: lowStock.map((v) => ({ variantId: v.id, label: v.label, stock: v.stock, productId: v.product.id, name: v.product.name, brand: v.product.brand })),
    recentOrders: recent.map((o) => ({
      id: o.id,
      number: orderNumber(o.seq),
      status: o.status,
      total: o.total,
      createdAt: o.createdAt,
      customer: o.customer.name ?? o.customer.phone,
    })),
    series,
    topProducts: topItems.map((t) => ({ productId: t.productId, name: t.name, brand: t.brand, qty: t._sum.qty ?? 0 })),
  });
});

// ---------- Orders ----------

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PLACED: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

adminOps.get("/orders", async (req, res) => {
  const q = req.query as Record<string, string>;
  const { page, limit, skip } = pageParams(q, 100);
  const seq = q.q ? parseOrderNumber(q.q) : null;
  const where: Prisma.OrderWhereInput = {
    ...(q.status ? { status: q.status as OrderStatus } : { status: { not: "PENDING_PAYMENT" } }),
    ...(q.paymentStatus ? { paymentStatus: q.paymentStatus as Prisma.EnumPaymentStatusFilter["equals"] } : {}),
    ...(q.customerId ? { customerId: q.customerId } : {}),
    ...(q.q
      ? seq !== null
        ? { seq }
        : { customer: { OR: [{ phone: { contains: q.q } }, { name: { contains: q.q, mode: "insensitive" } }] } }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit, include: { items: true, customer: { select: { id: true, name: true, phone: true } } } }),
    prisma.order.count({ where }),
  ]);
  res.json({ items: items.map((o) => ({ ...orderOut(o), customer: o.customer })), total, page, limit });
});

adminOps.get("/orders/:id", async (req, res) => {
  const o = await prisma.order.findUnique({ where: { id: String(req.params.id) }, include: { ...orderInclude, customer: true } });
  if (!o) throw notFound("Order not found");
  res.json({
    ...orderOut(o),
    events: o.events.map((e) => ({ status: e.status, note: e.note, actor: e.actor, createdAt: e.createdAt })),
    notes: o.notes,
    razorpayOrderId: o.razorpayOrderId,
    razorpayPaymentId: o.razorpayPaymentId,
    customer: { id: o.customer.id, name: o.customer.name, phone: o.customer.phone, email: o.customer.email },
    nextStatuses: NEXT[o.status],
  });
});

adminOps.post("/orders/:id/status", async (req, res) => {
  const { status, note } = parse(
    z.object({ status: z.enum(["PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"]), note: z.string().trim().max(500).optional() }),
    req.body,
  );
  const o = await prisma.order.findUnique({ where: { id: String(req.params.id) } });
  if (!o) throw notFound("Order not found");
  if (!NEXT[o.status].includes(status)) throw badRequest(`Can't move an order from ${o.status} to ${status}`);
  const actor = req.admin!.email;
  if (status === "CANCELLED") {
    await cancelOrder(o.id, note || "Cancelled by store", actor, [o.status]);
  } else {
    await prisma.$transaction(async (tx) => {
      const r = await tx.order.updateMany({
        where: { id: o.id, status: o.status },
        data: { status, ...(status === "DELIVERED" && o.paymentMethod === "COD" ? { paymentStatus: "PAID" } : {}) },
      });
      if (r.count !== 1) throw new HttpError(409, "This order was updated by someone else. Refresh and try again.", "stale");
      await tx.orderEvent.create({ data: { orderId: o.id, status, note: note || null, actor } });
      if (status === "DELIVERED") await awardOrderPoints(tx, o.id, actor);
      if (status === "RETURNED") await reverseOrderPoints(tx, o.id, actor);
    });
  }
  res.json({ ok: true });
});

adminOps.post("/orders/:id/refund", requireAdmin("ADMIN"), async (req, res) => {
  const { note } = parse(z.object({ note: z.string().trim().max(500).optional() }), req.body);
  const o = await prisma.order.findUnique({ where: { id: String(req.params.id) } });
  if (!o) throw notFound("Order not found");
  if (o.paymentStatus !== "PAID") throw badRequest("Only paid orders can be marked as refunded");
  await prisma.$transaction([
    prisma.order.update({ where: { id: o.id }, data: { paymentStatus: "REFUNDED" } }),
    prisma.orderEvent.create({ data: { orderId: o.id, status: o.status, note: `Refund recorded${note ? `: ${note}` : ""}`, actor: req.admin!.email } }),
  ]);
  res.json({ ok: true });
});

// ---------- Customers ----------

adminOps.get("/customers", async (req, res) => {
  const q = req.query as Record<string, string>;
  const { page, limit, skip } = pageParams(q, 100);
  const where: Prisma.CustomerWhereInput = {
    ...(q.q
      ? {
          OR: [
            { phone: { contains: q.q } },
            { name: { contains: q.q, mode: "insensitive" } },
            { email: { contains: q.q, mode: "insensitive" } },
            { companyName: { contains: q.q, mode: "insensitive" } },
            { gstin: { contains: q.q.toUpperCase() } },
          ],
        }
      : {}),
    ...(q.tag ? { tags: { has: q.tag.toLowerCase() } } : {}),
    ...(q.business === "true" ? { gstin: { not: null } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.customer.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.customer.count({ where }),
  ]);
  const stats = await prisma.order.groupBy({
    by: ["customerId"],
    where: { customerId: { in: rows.map((r) => r.id) }, status: { in: REVENUE_STATUSES } },
    _sum: { total: true },
    _count: { _all: true },
  });
  res.json({
    items: rows.map((c) => {
      const s = stats.find((x) => x.customerId === c.id);
      return { ...c, orders: s?._count._all ?? 0, spent: s?._sum.total ?? 0 };
    }),
    total,
    page,
    limit,
  });
});

adminOps.get("/customers/:id", async (req, res) => {
  const c = await prisma.customer.findUnique({
    where: { id: String(req.params.id) },
    include: {
      addresses: true,
      pets: true,
      orders: { orderBy: { createdAt: "desc" }, take: 50, include: { items: true } },
      pointTxns: { orderBy: { createdAt: "desc" }, take: 100 },
      referredBy: { select: { id: true, name: true, phone: true } },
      referrals: { select: { id: true, name: true, phone: true, createdAt: true } },
    },
  });
  if (!c) throw notFound("Customer not found");
  const settings = await getSettings();
  const referralCode = await ensureReferralCode(c.id);
  res.json({ ...c, referralCode, tier: tierFor(c.lifetimePoints, settings), orders: c.orders.map(orderOut) });
});

const gstinRe = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const customerPatch = z.object({
  isBlocked: z.boolean().optional(),
  companyName: z.string().trim().max(160).nullable().optional().transform((v) => (v === undefined ? undefined : v || null)),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || gstinRe.test(v), "Enter a valid 15-character GSTIN")
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null)),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v), "Enter a valid PAN")
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null)),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(20).optional(),
  notes: z.string().max(4000).optional(),
  /** Phone number or referral code of the customer who referred this one; "" clears it. */
  referredBy: z.string().trim().max(20).optional(),
});

adminOps.patch("/customers/:id", requireAdmin("ADMIN"), async (req, res) => {
  const { referredBy, ...d } = parse(customerPatch, req.body);
  const id = String(req.params.id);
  let referredById: string | null | undefined;
  if (referredBy !== undefined) {
    if (!referredBy) referredById = null;
    else {
      const ref = await prisma.customer.findFirst({ where: { OR: [{ phone: referredBy.replace(/\D/g, "").slice(-10) }, { referralCode: referredBy.toUpperCase() }] } });
      if (!ref) throw badRequest("No customer found with that phone number or referral code");
      if (ref.id === id) throw badRequest("A customer can't refer themselves");
      referredById = ref.id;
    }
  }
  res.json(await prisma.customer.update({ where: { id }, data: { ...d, ...(referredById !== undefined ? { referredById } : {}) } }));
});

adminOps.post("/customers/:id/points", requireAdmin("ADMIN"), async (req, res) => {
  const { points, note } = parse(
    z.object({ points: z.number().int().min(-100_000).max(100_000).refine((v) => v !== 0, "Enter points to add or remove"), note: z.string().trim().min(2, "Add a reason").max(200) }),
    req.body,
  );
  const t = await prisma.$transaction((tx) => grantPoints(tx, String(req.params.id), points, "ADMIN", { note, actor: req.admin!.email }));
  if (!t) throw badRequest("Nothing to change — the customer has no points to remove");
  res.json(t);
});

// ---------- Coupons ----------

const couponSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, "Use 3-30 letters, numbers, - or _"),
    description: z.string().trim().max(200).default(""),
    type: z.enum(["PERCENT", "FLAT", "BXGY"]),
    value: z.number().int().min(0).default(0),
    scope: z.enum(["ALL", "CATEGORY", "BRAND", "PRODUCT"]).default("ALL"),
    scopeIds: z.array(z.string().trim().min(1).max(80)).max(200).default([]),
    minQty: z.number().int().min(0).max(1000).default(0),
    buyQty: z.number().int().min(1).max(100).optional().nullable(),
    getQty: z.number().int().min(1).max(100).optional().nullable(),
    isPublic: z.boolean().default(true),
    badgeText: z.string().trim().max(30).optional().nullable().transform((v) => v || null),
    maxDiscount: z.number().int().positive().optional().nullable(),
    minOrder: z.number().int().min(0).default(0),
    startsAt: z.coerce.date().optional().nullable(),
    endsAt: z.coerce.date().optional().nullable(),
    usageLimit: z.number().int().positive().optional().nullable(),
    perCustomerLimit: z.number().int().positive().optional().nullable(),
    firstOrderOnly: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .refine((c) => c.type !== "PERCENT" || (c.value >= 1 && c.value <= 100), { message: "Percent must be 1-100", path: ["value"] })
  .refine((c) => c.type !== "FLAT" || c.value >= 100, { message: "Enter an amount of at least ₹1", path: ["value"] })
  .refine((c) => c.type !== "BXGY" || (c.buyQty && c.getQty), { message: "Enter how many to buy and how many free", path: ["buyQty"] })
  .refine((c) => c.scope === "ALL" || c.scopeIds.length > 0, { message: "Choose at least one item for this coupon", path: ["scopeIds"] })
  .transform((c) => (c.type === "BXGY" ? c : { ...c, buyQty: null, getQty: null }));

adminOps.get("/coupons", async (_req, res) => {
  res.json({ items: await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }) });
});
adminOps.post("/coupons", requireAdmin("ADMIN"), async (req, res) => {
  res.status(201).json(await prisma.coupon.create({ data: parse(couponSchema, req.body) }));
});
adminOps.put("/coupons/:id", requireAdmin("ADMIN"), async (req, res) => {
  res.json(await prisma.coupon.update({ where: { id: String(req.params.id) }, data: parse(couponSchema, req.body) }));
});
adminOps.delete("/coupons/:id", requireAdmin("ADMIN"), async (req, res) => {
  await prisma.coupon.delete({ where: { id: String(req.params.id) } });
  res.status(204).end();
});

// ---------- Reviews ----------

async function recomputeRating(productId: string) {
  const agg = await prisma.review.aggregate({ where: { productId, status: "APPROVED" }, _avg: { rating: true }, _count: true });
  await prisma.product.update({
    where: { id: productId },
    data: { rating: Math.round((agg._avg.rating ?? 0) * 10) / 10, reviewCount: agg._count },
  });
}

adminOps.get("/reviews", async (req, res) => {
  const q = req.query as Record<string, string>;
  const { page, limit, skip } = pageParams(q, 100);
  const where: Prisma.ReviewWhereInput = q.status ? { status: q.status as Prisma.EnumReviewStatusFilter["equals"] } : {};
  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { product: { select: { name: true, slug: true } }, customer: { select: { name: true, phone: true } } },
    }),
    prisma.review.count({ where }),
  ]);
  res.json({ items, total, page, limit });
});

adminOps.patch("/reviews/:id", async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(["APPROVED", "REJECTED", "PENDING"]) }), req.body);
  const r = await prisma.review.update({ where: { id: String(req.params.id) }, data: { status } });
  await recomputeRating(r.productId);
  if (status === "APPROVED") {
    const s = await getSettings();
    if (s.loyalty.enabled && s.loyalty.reviewPoints > 0)
      await prisma.$transaction((tx) => grantPoints(tx, r.customerId, s.loyalty.reviewPoints, "REVIEW", { reviewId: r.id, actor: req.admin!.email, note: "Review approved" }));
  }
  res.json(r);
});

adminOps.delete("/reviews/:id", requireAdmin("ADMIN"), async (req, res) => {
  const r = await prisma.review.delete({ where: { id: String(req.params.id) } });
  await recomputeRating(r.productId);
  res.status(204).end();
});

// ---------- Messages & subscribers ----------

adminOps.get("/messages", async (req, res) => {
  const status = req.query.status === "RESOLVED" ? "RESOLVED" : req.query.status === "NEW" ? "NEW" : undefined;
  res.json({ items: await prisma.contactMessage.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 200 }) });
});

adminOps.patch("/messages/:id", async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(["NEW", "RESOLVED"]) }), req.body);
  res.json(await prisma.contactMessage.update({ where: { id: String(req.params.id) }, data: { status } }));
});

adminOps.get("/subscribers", requireAdmin("ADMIN"), async (_req, res) => {
  res.json({ items: await prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: "desc" } }) });
});

// ---------- Team (super admins only) ----------

adminOps.get("/team", requireAdmin("SUPER_ADMIN"), async (_req, res) => {
  res.json({ items: (await prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } })).map(adminOut) });
});

adminOps.post("/team", requireAdmin("SUPER_ADMIN"), async (req, res) => {
  const d = parse(
    z.object({
      email: z.string().trim().toLowerCase().email(),
      name: z.string().trim().min(1).max(80),
      role: z.enum(["SUPER_ADMIN", "ADMIN", "STAFF"]),
      password: passwordSchema,
    }),
    req.body,
  );
  const a = await prisma.adminUser.create({ data: { email: d.email, name: d.name, role: d.role, passwordHash: await bcrypt.hash(d.password, 12) } });
  res.status(201).json(adminOut(a));
});

adminOps.patch("/team/:id", requireAdmin("SUPER_ADMIN"), async (req, res) => {
  const d = parse(
    z.object({ role: z.enum(["SUPER_ADMIN", "ADMIN", "STAFF"]).optional(), isActive: z.boolean().optional(), password: passwordSchema.optional() }),
    req.body,
  );
  if (String(req.params.id) === req.admin!.id && (d.isActive === false || (d.role && d.role !== "SUPER_ADMIN")))
    throw badRequest("You can't deactivate or demote yourself");
  const a = await prisma.adminUser.update({
    where: { id: String(req.params.id) },
    data: { role: d.role, isActive: d.isActive, ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 12) } : {}) },
  });
  res.json(adminOut(a));
});
