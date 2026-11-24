import { Router } from "express";
import express from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { badRequest, forbidden, logger, notFound, parseOrderNumber, prisma } from "../lib/core.js";
import { parse } from "../lib/http.js";
import { optionalCustomer, requireCustomer } from "../lib/auth.js";
import { buildQuote } from "../lib/pricing.js";
import { cancelOrder, markPaid, orderInclude, placeOrder } from "../lib/orders.js";
import { orderOut } from "../lib/serialize.js";
import { verifyRazorpayPayment, verifyRazorpayWebhook } from "../lib/services.js";

export const orders = Router();

const itemsSchema = z.array(z.object({ variantId: z.string().min(1).max(40), qty: z.number().int().min(1).max(20) })).max(50);

orders.post("/cart/quote", optionalCustomer, async (req, res) => {
  const body = parse(
    z.object({
      items: itemsSchema,
      couponCode: z.string().trim().max(40).optional().nullable(),
      pincode: z.string().regex(/^\d{6}$/).optional().nullable(),
      speed: z.enum(["STANDARD", "EXPRESS"]).optional(),
      pointsToRedeem: z.number().int().min(0).max(1_000_000).optional(),
    }),
    req.body,
  );
  res.json(await buildQuote({ ...body, customerId: req.customerId }));
});

async function findOwnOrder(customerId: string, number: string) {
  const seq = parseOrderNumber(number);
  if (seq === null) throw notFound("Order not found");
  const order = await prisma.order.findUnique({ where: { seq }, include: orderInclude });
  if (!order || order.customerId !== customerId) throw notFound("Order not found");
  return order;
}

orders.post("/orders", requireCustomer, async (req, res) => {
  const body = parse(
    z.object({
      items: itemsSchema.min(1, "Your cart is empty"),
      addressId: z.string().min(1, "Please choose a delivery address"),
      couponCode: z.string().trim().max(40).optional().nullable(),
      speed: z.enum(["STANDARD", "EXPRESS"]).default("STANDARD"),
      payment: z.enum(["COD", "ONLINE"]),
      notes: z.string().trim().max(500).optional().nullable(),
      pointsToRedeem: z.number().int().min(0).max(1_000_000).optional(),
    }),
    req.body,
  );
  const { order, payment } = await placeOrder({ ...body, customerId: req.customerId! });
  res.status(201).json({ order: orderOut(order), payment });
});

orders.get("/orders", requireCustomer, async (req, res) => {
  const rows = await prisma.order.findMany({
    where: { customerId: req.customerId, NOT: { status: "PENDING_PAYMENT", createdAt: { lt: new Date(Date.now() - 36e5) } } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { items: true },
  });
  res.json({ items: rows.map(orderOut) });
});

orders.get("/orders/:number", requireCustomer, async (req, res) => {
  res.json(orderOut(await findOwnOrder(req.customerId!, String(req.params.number))));
});

orders.post("/orders/:number/cancel", requireCustomer, async (req, res) => {
  const order = await findOwnOrder(req.customerId!, String(req.params.number));
  const updated = await cancelOrder(order.id, "Cancelled by customer", "customer");
  res.json(orderOut(updated));
});

// ---------- Payments ----------

orders.post("/payments/razorpay/verify", requireCustomer, async (req, res) => {
  const body = parse(
    z.object({ orderNumber: z.string(), razorpayOrderId: z.string(), razorpayPaymentId: z.string(), razorpaySignature: z.string() }),
    req.body,
  );
  const order = await findOwnOrder(req.customerId!, body.orderNumber);
  if (order.razorpayOrderId !== body.razorpayOrderId) throw badRequest("Payment does not match this order", "payment_mismatch");
  if (!verifyRazorpayPayment(body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature))
    throw badRequest("We couldn't verify this payment. If money was deducted, it will be refunded automatically.", "payment_invalid");
  await markPaid({ id: order.id }, body.razorpayPaymentId, "customer");
  res.json(orderOut(await findOwnOrder(req.customerId!, body.orderNumber)));
});

orders.post("/payments/mock/confirm", requireCustomer, async (req, res) => {
  if (env.PAYMENT_PROVIDER !== "mock") throw forbidden("Mock payments are disabled");
  const { orderNumber } = parse(z.object({ orderNumber: z.string() }), req.body);
  const order = await findOwnOrder(req.customerId!, orderNumber);
  await markPaid({ id: order.id }, `mock_${Date.now()}`, "customer");
  res.json(orderOut(await findOwnOrder(req.customerId!, orderNumber)));
});

/** Razorpay server-to-server webhook (configure in the Razorpay dashboard). Mounted before the JSON parser. */
export const razorpayWebhook = Router();
razorpayWebhook.post("/webhooks/razorpay", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
  const sig = req.get("x-razorpay-signature") ?? "";
  if (!verifyRazorpayWebhook(req.body as Buffer, sig)) return res.status(400).json({ error: { code: "bad_signature", message: "Invalid signature" } });
  const event = JSON.parse((req.body as Buffer).toString("utf8")) as {
    event: string;
    payload?: { payment?: { entity?: { id: string; order_id: string } } };
  };
  const p = event.payload?.payment?.entity;
  try {
    if ((event.event === "payment.captured" || event.event === "order.paid") && p?.order_id) {
      await markPaid({ razorpayOrderId: p.order_id }, p.id, "webhook");
    } else if (event.event === "payment.failed" && p?.order_id) {
      await prisma.order.updateMany({ where: { razorpayOrderId: p.order_id, paymentStatus: "PENDING" }, data: { paymentStatus: "FAILED" } });
    }
  } catch (err) {
    logger.warn({ err, event: event.event }, "Webhook processing issue");
  }
  res.json({ ok: true });
});
