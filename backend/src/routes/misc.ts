import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { isTest } from "../config/env.js";
import { notFound, prisma } from "../lib/core.js";
import { parse } from "../lib/http.js";
import { requireCustomer } from "../lib/auth.js";

export const misc = Router();

const formLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: isTest ? 1000 : 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many submissions. Please try again later." } },
});

misc.post("/products/:slug/reviews", requireCustomer, async (req, res) => {
  const body = parse(
    z.object({
      rating: z.number().int().min(1).max(5),
      title: z.string().trim().min(2).max(120),
      body: z.string().trim().min(10, "Please write at least 10 characters").max(2000),
    }),
    req.body,
  );
  const product = await prisma.product.findUnique({ where: { slug: String(req.params.slug) }, select: { id: true } });
  if (!product) throw notFound("Product not found");
  const bought = await prisma.orderItem.count({
    where: { productId: product.id, order: { customerId: req.customerId, status: "DELIVERED" } },
  });
  const review = await prisma.review.upsert({
    where: { productId_customerId: { productId: product.id, customerId: req.customerId! } },
    create: { ...body, productId: product.id, customerId: req.customerId!, verified: bought > 0 },
    update: { ...body, status: "PENDING", verified: bought > 0 },
  });
  res.status(201).json({ id: review.id, status: review.status, message: "Thanks! Your review will appear once it's approved." });
});

misc.post("/contact", formLimiter, async (req, res) => {
  const body = parse(
    z
      .object({
        name: z.string().trim().min(1).max(80),
        phone: z.string().trim().max(20).optional().or(z.literal("")),
        email: z.string().trim().email().max(120).optional().or(z.literal("")),
        topic: z.string().trim().max(60).default("General"),
        message: z.string().trim().min(5).max(3000),
      })
      .refine((v) => v.phone || v.email, { message: "Please add a phone number or email", path: ["email"] }),
    req.body,
  );
  await prisma.contactMessage.create({ data: { ...body, phone: body.phone || null, email: body.email || null } });
  res.status(201).json({ ok: true });
});

misc.post("/newsletter", formLimiter, async (req, res) => {
  const { email } = parse(z.object({ email: z.string().trim().toLowerCase().email().max(120) }), req.body);
  await prisma.newsletterSubscriber.upsert({ where: { email }, create: { email }, update: {} });
  res.status(201).json({ ok: true });
});
