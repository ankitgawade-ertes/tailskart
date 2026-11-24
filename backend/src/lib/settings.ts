import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { careBranches, env } from "../config/env.js";
import { prisma } from "./core.js";

const money = z.number().int().min(0).max(10_000_000);
const url = z.string().trim().max(300).default("");

/** Everything the store owner can change from Admin → Settings. Money is in paise. */
export const settingsSchema = z.object({
  store: z
    .object({
      name: z.string().trim().min(1).max(80).default("Tailskart"),
      tagline: z.string().trim().max(160).default("Their everyday, delivered."),
      legalName: z.string().trim().max(160).default("MODOS SIBIS PRIVATE LIMITED"),
      phone: z.string().trim().max(30).default("+91 90000 00000"),
      whatsapp: z.string().trim().max(30).default("+91 90000 00000"),
      email: z.string().trim().max(120).default("hello@tailskart.in"),
      address: z.string().trim().max(400).default("Tailskart HQ, 2nd Floor, Placeholder Road, Bengaluru 560001"),
      state: z.string().trim().max(60).default("Karnataka"),
      hours: z.string().trim().max(80).default("Mon–Sun, 9am – 9pm"),
      gstin: z.string().trim().toUpperCase().max(15).default(""),
      invoicePrefix: z.string().trim().toUpperCase().max(10).default("TK"),
    })
    .default({}),
  social: z.object({ instagram: url, facebook: url, youtube: url, x: url }).default({}),
  announcements: z.array(z.string().trim().min(1).max(160)).max(6).default([]),
  shipping: z
    .object({
      freeShippingMin: money.default(env.FREE_SHIPPING_MIN),
      shippingFee: money.default(env.SHIPPING_FEE),
      expressFee: money.default(env.EXPRESS_FEE),
    })
    .default({}),
  cod: z
    .object({ enabled: z.boolean().default(env.COD_ENABLED), min: money.default(env.COD_MIN), max: money.default(env.COD_MAX) })
    .default({}),
  loyalty: z
    .object({
      enabled: z.boolean().default(true),
      /** Points earned for every ₹100 of a delivered order. 1 point = ₹1 when redeemed. */
      pointsPer100: z.number().int().min(0).max(100).default(2),
      reviewPoints: z.number().int().min(0).max(10_000).default(20),
      referrerPoints: z.number().int().min(0).max(10_000).default(100),
      refereePoints: z.number().int().min(0).max(10_000).default(50),
      maxRedeemPercent: z.number().int().min(0).max(100).default(20),
      silverAt: z.number().int().min(0).default(500),
      goldAt: z.number().int().min(0).default(2000),
      platinumAt: z.number().int().min(0).default(5000),
    })
    .default({}),
  branches: z.array(z.string().trim().min(1).max(80)).max(30).default(careBranches),
  lowStockDefault: z.number().int().min(0).max(10_000).default(5),
});
export type StoreSettings = z.infer<typeof settingsSchema>;

const KEY = "store";
let cache: { at: number; value: StoreSettings } | null = null;

export async function getSettings(db: Prisma.TransactionClient = prisma): Promise<StoreSettings> {
  if (cache && Date.now() - cache.at < 15_000) return cache.value;
  const row = await db.setting.findUnique({ where: { key: KEY } });
  const parsed = settingsSchema.safeParse(row?.value ?? {});
  const value = parsed.success ? parsed.data : settingsSchema.parse({});
  cache = { at: Date.now(), value };
  return value;
}

export async function saveSettings(input: unknown, actor: string) {
  const value = settingsSchema.parse(input);
  await prisma.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value, updatedBy: actor },
    update: { value, updatedBy: actor },
  });
  cache = null;
  return value;
}

export const clearSettingsCache = () => {
  cache = null;
};

/** Safe subset for the storefront. */
export const publicSettings = (s: StoreSettings) => ({
  store: s.store,
  social: s.social,
  announcements: s.announcements,
  shipping: s.shipping,
  cod: s.cod,
  branches: s.branches,
  loyalty: { enabled: s.loyalty.enabled, pointsPer100: s.loyalty.pointsPer100, maxRedeemPercent: s.loyalty.maxRedeemPercent },
});

export function tierFor(lifetime: number, s: StoreSettings) {
  const l = s.loyalty;
  return lifetime >= l.platinumAt ? "Platinum" : lifetime >= l.goldAt ? "Gold" : lifetime >= l.silverAt ? "Silver" : "Member";
}
