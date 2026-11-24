import type { Coupon, Prisma } from "@prisma/client";
import { env, sameDayPrefixes } from "../config/env.js";
import { prisma } from "./core.js";
import { getSettings } from "./settings.js";

export interface LineInput {
  variantId: string;
  qty: number;
}

export function deliveryInfo(pincode?: string | null) {
  if (!pincode) return { pincode: null, serviceable: true, sameDay: false, etaDays: [2, 5] as [number, number] };
  const valid = /^[1-9]\d{5}$/.test(pincode);
  const sameDay = valid && sameDayPrefixes.some((p) => pincode.startsWith(p));
  const metro = /^(11|40|56|60|70|50|41)/.test(pincode);
  return {
    pincode,
    serviceable: valid,
    sameDay,
    etaDays: (sameDay ? [0, 1] : metro ? [1, 2] : [3, 6]) as [number, number],
  };
}

export interface CouponLine {
  productId: string;
  categoryId: string;
  brand: string;
  price: number;
  qty: number;
}

/** Lines a coupon applies to, based on its scope (whole cart, categories, brands or products). */
export function eligibleLines<L extends CouponLine>(coupon: Pick<Coupon, "scope" | "scopeIds">, lines: L[]) {
  const ids = new Set(coupon.scopeIds);
  const brands = new Set(coupon.scopeIds.map((b) => b.toLowerCase()));
  switch (coupon.scope) {
    case "CATEGORY":
      return lines.filter((l) => ids.has(l.categoryId));
    case "PRODUCT":
      return lines.filter((l) => ids.has(l.productId));
    case "BRAND":
      return lines.filter((l) => brands.has(l.brand.toLowerCase()));
    default:
      return lines;
  }
}

/** Validates a coupon against the cart; returns discount in paise or an error message. */
export async function evaluateCoupon(
  coupon: Coupon | null,
  lines: CouponLine[],
  customerId: string | undefined,
  db: Prisma.TransactionClient = prisma,
): Promise<{ discount: number; error?: string }> {
  if (!coupon || !coupon.isActive) return { discount: 0, error: "This code isn't valid" };
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return { discount: 0, error: "This code isn't active yet" };
  if (coupon.endsAt && coupon.endsAt < now) return { discount: 0, error: "This code has expired" };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return { discount: 0, error: "This code has reached its usage limit" };

  const eligible = eligibleLines(coupon, lines);
  if (!eligible.length) return { discount: 0, error: "This code doesn't apply to the items in your cart" };
  const eligibleTotal = eligible.reduce((s, l) => s + l.price * l.qty, 0);
  const eligibleQty = eligible.reduce((s, l) => s + l.qty, 0);
  const cartTotal = lines.reduce((s, l) => s + l.price * l.qty, 0);

  if (cartTotal < coupon.minOrder) return { discount: 0, error: `Add items worth ₹${Math.ceil((coupon.minOrder - cartTotal) / 100)} more to use this code` };
  if (coupon.minQty > 0 && eligibleQty < coupon.minQty) return { discount: 0, error: `Add ${coupon.minQty - eligibleQty} more eligible item(s) to use this code` };

  if (customerId) {
    if (coupon.firstOrderOnly) {
      const prior = await db.order.count({ where: { customerId, status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } } });
      if (prior > 0) return { discount: 0, error: "This code is only for your first order" };
    }
    if (coupon.perCustomerLimit !== null) {
      const used = await db.order.count({ where: { customerId, couponCode: coupon.code, status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } } });
      if (used >= coupon.perCustomerLimit) return { discount: 0, error: "You've already used this code" };
    }
  }

  let discount: number;
  if (coupon.type === "BXGY") {
    const buy = coupon.buyQty ?? 1;
    const get = coupon.getQty ?? 1;
    const free = Math.floor(eligibleQty / (buy + get)) * get;
    if (free === 0) return { discount: 0, error: `Add ${buy + get - eligibleQty} more eligible item(s) to get ${get} free` };
    // The cheapest eligible units are the free ones.
    const units = eligible.flatMap((l) => Array.from({ length: l.qty }, () => l.price)).sort((a, b) => a - b);
    discount = units.slice(0, free).reduce((s, p) => s + p, 0);
  } else {
    discount = coupon.type === "PERCENT" ? Math.floor((eligibleTotal * coupon.value) / 100) : coupon.value;
  }
  if (coupon.maxDiscount !== null) discount = Math.min(discount, coupon.maxDiscount);
  return { discount: Math.min(discount, eligibleTotal) };
}

export async function buildQuote(
  input: {
    items: LineInput[];
    couponCode?: string | null;
    pincode?: string | null;
    speed?: "STANDARD" | "EXPRESS";
    customerId?: string;
    pointsToRedeem?: number;
  },
  db: Prisma.TransactionClient = prisma,
) {
  const merged = new Map<string, number>();
  for (const it of input.items) merged.set(it.variantId, Math.min((merged.get(it.variantId) ?? 0) + it.qty, 20));

  const variants = await db.variant.findMany({
    where: { id: { in: [...merged.keys()] } },
    include: { product: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } } },
  });

  const issues: { variantId: string; message: string }[] = [];
  const lines = [];
  for (const [variantId, qty] of merged) {
    const v = variants.find((x) => x.id === variantId);
    if (!v || !v.isActive || v.product.status !== "ACTIVE") {
      issues.push({ variantId, message: "This item is no longer available" });
      continue;
    }
    if (v.product.tags.includes("rx")) {
      // Prescription-only medicines are dispensed by the pharko pharmacist, never through the normal cart.
      issues.push({ variantId, message: "This medicine needs a vet’s prescription — order it through pharko" });
      continue;
    }
    const available = Math.max(0, Math.min(qty, v.stock));
    if (available < qty) issues.push({ variantId, message: v.stock === 0 ? "Out of stock" : `Only ${v.stock} left in stock` });
    if (available === 0) continue;
    lines.push({
      variantId: v.id,
      productId: v.productId,
      categoryId: v.product.categoryId,
      hsn: v.product.hsn,
      gstRate: v.product.gstRate,
      slug: v.product.slug,
      name: v.product.name,
      brand: v.product.brand,
      label: v.label,
      sku: v.sku,
      price: v.price,
      mrp: v.mrp,
      qty: available,
      stock: v.stock,
      image: v.product.images[0]?.url ?? null,
      kind: v.product.artKind,
      tint: v.product.tint,
      lineTotal: v.price * available,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const mrpTotal = lines.reduce((s, l) => s + l.mrp * l.qty, 0);

  let discount = 0;
  let coupon: { code: string; description: string } | null = null;
  let couponError: string | undefined;
  const code = input.couponCode?.trim().toUpperCase();
  if (code) {
    const c = await db.coupon.findUnique({ where: { code } });
    const r = await evaluateCoupon(c, lines, input.customerId, db);
    if (r.error) couponError = r.error;
    else {
      discount = r.discount;
      coupon = { code: c!.code, description: c!.description };
    }
  }

  const settings = await getSettings(db);
  const { shipping, cod, loyalty } = settings;

  // Loyalty points: 1 point = Rs 1, capped at a share of the discounted subtotal.
  let pointsRedeemed = 0;
  let pointsBalance = 0;
  if (input.customerId && loyalty.enabled) {
    const c = await db.customer.findUnique({ where: { id: input.customerId }, select: { points: true } });
    pointsBalance = c?.points ?? 0;
    if (input.pointsToRedeem && input.pointsToRedeem > 0) {
      const capPaise = Math.floor(((subtotal - discount) * loyalty.maxRedeemPercent) / 100);
      pointsRedeemed = Math.max(0, Math.min(input.pointsToRedeem, pointsBalance, Math.floor(capPaise / 100)));
    }
  }
  const pointsDiscount = pointsRedeemed * 100;

  const delivery = deliveryInfo(input.pincode);
  const shippingFee = subtotal === 0 || subtotal >= shipping.freeShippingMin ? 0 : shipping.shippingFee;
  const expressFee = input.speed === "EXPRESS" && delivery.sameDay ? shipping.expressFee : 0;
  const total = Math.max(0, subtotal - discount - pointsDiscount) + shippingFee + expressFee;

  const codAvailable = cod.enabled && total >= cod.min && total <= cod.max;

  return {
    lines,
    issues,
    mrpTotal,
    subtotal,
    discount,
    coupon,
    couponError,
    points: { balance: pointsBalance, redeemed: pointsRedeemed, discount: pointsDiscount },
    shippingFee,
    expressFee,
    total,
    delivery,
    cod: {
      available: codAvailable,
      reason: codAvailable
        ? null
        : cod.enabled
          ? `Cash on delivery is available for orders between ₹${cod.min / 100} and ₹${cod.max / 100}`
          : "Cash on delivery isn't available right now",
    },
  };
}

export type Quote = Awaited<ReturnType<typeof buildQuote>>;

export const storeConfig = async () => {
  const s = await getSettings();
  return {
  freeShippingMin: s.shipping.freeShippingMin,
  shippingFee: s.shipping.shippingFee,
  expressFee: s.shipping.expressFee,
  cod: s.cod,
  payments: {
    provider: env.PAYMENT_PROVIDER,
    razorpayKeyId: env.PAYMENT_PROVIDER === "razorpay" ? env.RAZORPAY_KEY_ID : null,
  },
};
};
