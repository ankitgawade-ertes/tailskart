import type { OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { env } from "../config/env.js";
import { HttpError, badRequest, conflict, logger, notFound, orderNumber, prisma } from "./core.js";
import { buildQuote, type LineInput } from "./pricing.js";
import { createRazorpayOrder } from "./services.js";
import { logMovement } from "./stock.js";
import { grantPoints, reverseOrderPoints } from "./loyalty.js";

const orderInclude = { items: true, events: { orderBy: { createdAt: "asc" } } } as const;

export async function restoreStock(tx: Prisma.TransactionClient, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const it of items) {
    if (!it.variantId) continue;
    const r = await tx.variant.updateMany({ where: { id: it.variantId }, data: { stock: { increment: it.qty } } });
    if (r.count) await logMovement(tx, it.variantId, it.qty, "CANCEL", { note: `Order cancelled`, actor: "system" });
  }
}

export async function placeOrder(input: {
  customerId: string;
  items: LineInput[];
  addressId: string;
  couponCode?: string | null;
  speed: "STANDARD" | "EXPRESS";
  payment: "COD" | "ONLINE";
  notes?: string | null;
  pointsToRedeem?: number;
}) {
  const address = await prisma.address.findFirst({ where: { id: input.addressId, customerId: input.customerId } });
  if (!address) throw badRequest("Please choose a delivery address", "address_required");

  const method: PaymentMethod = input.payment === "COD" ? "COD" : env.PAYMENT_PROVIDER === "razorpay" ? "RAZORPAY" : "MOCK";

  const order = await prisma.$transaction(
    async (tx) => {
      const quote = await buildQuote(
        { items: input.items, couponCode: input.couponCode, pincode: address.pincode, speed: input.speed, customerId: input.customerId, pointsToRedeem: input.pointsToRedeem },
        tx,
      );
      if (quote.issues.length) throw new HttpError(409, "Some items in your cart changed. Please review your cart.", "cart_changed", quote.issues);
      if (!quote.lines.length) throw badRequest("Your cart is empty", "empty_cart");
      if (!quote.delivery.serviceable) throw badRequest("We don't deliver to this pincode yet", "not_serviceable");
      if (input.couponCode && quote.couponError) throw badRequest(quote.couponError, "coupon_invalid");
      if (method === "COD" && !quote.cod.available) throw badRequest(quote.cod.reason ?? "Cash on delivery isn't available", "cod_unavailable");

      // Reserve stock atomically; fails if another order took the last units.
      for (const l of quote.lines) {
        const r = await tx.variant.updateMany({ where: { id: l.variantId, stock: { gte: l.qty } }, data: { stock: { decrement: l.qty } } });
        if (r.count !== 1) throw conflict(`${l.name} (${l.label}) just went out of stock`, "out_of_stock");
        await logMovement(tx, l.variantId, -l.qty, "ORDER", { actor: "system" });
      }
      const customer = await tx.customer.findUniqueOrThrow({ where: { id: input.customerId }, select: { gstin: true, companyName: true } });

      const isCod = method === "COD";
      const status: OrderStatus = isCod ? "PLACED" : "PENDING_PAYMENT";
      const created = await tx.order.create({
        data: {
          customerId: input.customerId,
          status,
          paymentMethod: method,
          paymentStatus: "PENDING",
          shippingSpeed: input.speed === "EXPRESS" && quote.delivery.sameDay ? "EXPRESS" : "STANDARD",
          mrpTotal: quote.mrpTotal,
          subtotal: quote.subtotal,
          discount: quote.discount,
          shippingFee: quote.shippingFee + quote.expressFee,
          total: quote.total,
          couponCode: quote.coupon?.code ?? null,
          pointsRedeemed: quote.points.redeemed,
          billingGstin: customer.gstin,
          billingCompany: customer.companyName,
          notes: input.notes ?? null,
          placedAt: isCod ? new Date() : null,
          address: {
            name: address.name,
            phone: address.phone,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            label: address.label,
          },
          items: {
            create: quote.lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              slug: l.slug,
              name: l.name,
              brand: l.brand,
              variantLabel: l.label,
              sku: l.sku,
              image: l.image,
              artKind: l.kind,
              tint: l.tint,
              price: l.price,
              mrp: l.mrp,
              qty: l.qty,
              hsn: l.hsn,
              gstRate: l.gstRate,
            })),
          },
          events: { create: { status, note: isCod ? "Order placed (cash on delivery)" : "Awaiting payment" } },
        },
        include: orderInclude,
      });
      if (isCod && created.couponCode) await tx.coupon.update({ where: { code: created.couponCode }, data: { usedCount: { increment: 1 } } });
      if (quote.points.redeemed > 0)
        await grantPoints(tx, input.customerId, -quote.points.redeemed, "REDEEM", { orderId: created.id, note: "Used on order" });
      return created;
    },
    { isolationLevel: "Serializable", timeout: 15_000 },
  );

  if (method === "RAZORPAY") {
    try {
      const rzpId = await createRazorpayOrder(order.total, orderNumber(order.seq));
      await prisma.order.update({ where: { id: order.id }, data: { razorpayOrderId: rzpId } });
      return { order, payment: { provider: "razorpay" as const, keyId: env.RAZORPAY_KEY_ID, razorpayOrderId: rzpId, amount: order.total } };
    } catch (err) {
      await cancelOrder(order.id, "Payment gateway error", "system");
      throw err;
    }
  }
  if (method === "MOCK") return { order, payment: { provider: "mock" as const, amount: order.total } };
  return { order, payment: null };
}

/** Idempotently moves an order from PENDING_PAYMENT to PLACED + PAID. */
export async function markPaid(where: { id?: string; razorpayOrderId?: string }, paymentId: string, actor = "payment") {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where });
    if (!order) throw notFound("Order not found");
    if (order.paymentStatus === "PAID") return order;
    if (order.status === "CANCELLED") {
      // Payment arrived after the reservation expired: record it for a manual refund.
      logger.error({ order: order.id, paymentId }, "Payment received for cancelled order — refund required");
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID", razorpayPaymentId: paymentId } });
      await tx.orderEvent.create({ data: { orderId: order.id, status: "CANCELLED", note: "Payment received after cancellation — refund required", actor } });
      return order;
    }
    const r = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING_PAYMENT" },
      data: { status: "PLACED", paymentStatus: "PAID", razorpayPaymentId: paymentId, placedAt: new Date() },
    });
    if (r.count === 1) {
      await tx.orderEvent.create({ data: { orderId: order.id, status: "PLACED", note: "Payment received", actor } });
      if (order.couponCode) await tx.coupon.update({ where: { code: order.couponCode }, data: { usedCount: { increment: 1 } } });
    }
    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  });
}

export async function cancelOrder(orderId: string, note: string, actor: string, allowed: OrderStatus[] = ["PENDING_PAYMENT", "PLACED", "PACKED"]) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw notFound("Order not found");
    const r = await tx.order.updateMany({ where: { id: orderId, status: { in: allowed } }, data: { status: "CANCELLED" } });
    if (r.count !== 1) throw badRequest("This order can no longer be cancelled", "not_cancellable");
    await restoreStock(tx, orderId);
    await reverseOrderPoints(tx, orderId, actor);
    if (order.couponCode && order.status !== "PENDING_PAYMENT")
      await tx.coupon.updateMany({ where: { code: order.couponCode, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
    await tx.orderEvent.create({
      data: { orderId, status: "CANCELLED", note: order.paymentStatus === "PAID" ? `${note} — refund to be processed` : note, actor },
    });
    return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
  });
}

/** Releases stock held by online orders whose payment was never completed. */
export async function sweepAbandonedPayments() {
  const cutoff = new Date(Date.now() - env.PENDING_PAYMENT_TTL_MINUTES * 60_000);
  const stale = await prisma.order.findMany({ where: { status: "PENDING_PAYMENT", createdAt: { lt: cutoff } }, select: { id: true }, take: 200 });
  for (const o of stale) {
    try {
      await cancelOrder(o.id, "Payment not completed", "system", ["PENDING_PAYMENT"]);
    } catch {
      /* already handled by another instance */
    }
  }
  if (stale.length) logger.info({ count: stale.length }, "Released abandoned payment reservations");
}

export { orderInclude };
