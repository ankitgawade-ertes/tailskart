import type { PointReason, Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "./core.js";
import { getSettings } from "./settings.js";

/**
 * Adds (or removes, if negative) points. Grants tied to an order or review happen once only.
 * Positive grants (except reversals) also raise lifetime points, which decide the tier.
 */
export async function grantPoints(
  tx: Prisma.TransactionClient,
  customerId: string,
  points: number,
  reason: PointReason,
  extra: { note?: string; orderId?: string; reviewId?: string; actor?: string } = {},
) {
  if (!points) return null;
  if (extra.orderId || extra.reviewId) {
    const dup = await tx.pointTransaction.findFirst({
      where: { customerId, reason, ...(extra.orderId ? { orderId: extra.orderId } : {}), ...(extra.reviewId ? { reviewId: extra.reviewId } : {}) },
    });
    if (dup) return null;
  }
  const c = await tx.customer.findUniqueOrThrow({ where: { id: customerId }, select: { points: true } });
  const delta = points < 0 ? -Math.min(-points, c.points) : points;
  if (!delta) return null;
  await tx.customer.update({
    where: { id: customerId },
    data: { points: { increment: delta }, ...(delta > 0 && reason !== "REVERSAL" ? { lifetimePoints: { increment: delta } } : {}) },
  });
  return tx.pointTransaction.create({
    data: {
      customerId,
      points: delta,
      reason,
      note: extra.note ?? null,
      orderId: extra.orderId ?? null,
      reviewId: extra.reviewId ?? null,
      actor: extra.actor ?? null,
    },
  });
}

/** When an order is delivered: earn points, plus referral rewards on the customer's first delivered order. */
export async function awardOrderPoints(tx: Prisma.TransactionClient, orderId: string, actor: string) {
  const s = await getSettings(tx);
  if (!s.loyalty.enabled) return;
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { customer: true } });
  const earn = Math.floor(((o.total - o.shippingFee) / 10_000) * s.loyalty.pointsPer100);
  const t = await grantPoints(tx, o.customerId, earn, "ORDER", { orderId, actor, note: "Order delivered" });
  if (t) await tx.order.update({ where: { id: orderId }, data: { pointsEarned: t.points } });

  if (o.customer.referredById) {
    const delivered = await tx.order.count({ where: { customerId: o.customerId, status: "DELIVERED" } });
    if (delivered === 1) {
      const who = o.customer.name ?? o.customer.phone;
      await grantPoints(tx, o.customer.referredById, s.loyalty.referrerPoints, "REFERRAL", { orderId, actor, note: `Referred ${who}` });
      await grantPoints(tx, o.customerId, s.loyalty.refereePoints, "REFERRAL", {
        orderId: `${orderId}:referee`,
        actor,
        note: "Welcome bonus for joining by referral",
      });
    }
  }
}

/** Returned: take back earned points. Cancelled or returned: give back points spent on the order. */
export async function reverseOrderPoints(tx: Prisma.TransactionClient, orderId: string, actor: string) {
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (o.pointsEarned > 0) await grantPoints(tx, o.customerId, -o.pointsEarned, "REVERSAL", { orderId, actor, note: "Order returned" });
  if (o.pointsRedeemed > 0)
    await grantPoints(tx, o.customerId, o.pointsRedeemed, "REVERSAL", { orderId: `${orderId}:refund`, actor, note: "Points given back" });
}

export async function ensureReferralCode(customerId: string) {
  const c = await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { referralCode: true } });
  if (c.referralCode) return c.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = `TK${randomBytes(3).toString("hex").toUpperCase()}`;
    try {
      await prisma.customer.update({ where: { id: customerId }, data: { referralCode: code } });
      return code;
    } catch {
      /* code already taken — try another */
    }
  }
  throw new Error("Could not create a referral code");
}
