import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { PET_FROM_API, notFound, prisma } from "../lib/core.js";
import { pageParams, parse } from "../lib/http.js";
import { breedOut, categoryOut, productCard, productDetail } from "../lib/serialize.js";
import { deliveryInfo, eligibleLines, storeConfig } from "../lib/pricing.js";
import { getSettings, publicSettings } from "../lib/settings.js";

export const catalog = Router();

const list = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];

const SORTS: Record<string, Prisma.ProductOrderByWithRelationInput[]> = {
  popular: [{ reviewCount: "desc" }, { createdAt: "desc" }],
  price_asc: [{ minPrice: "asc" }],
  price_desc: [{ minPrice: "desc" }],
  discount: [{ maxDiscount: "desc" }, { reviewCount: "desc" }],
  rating: [{ rating: "desc" }, { reviewCount: "desc" }],
  new: [{ createdAt: "desc" }],
};

const include = { variants: true, images: true, category: true } as const;

function baseWhere(q: Record<string, unknown>): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ status: "ACTIVE" }];
  const pet = typeof q.pet === "string" ? PET_FROM_API[q.pet as keyof typeof PET_FROM_API] : undefined;
  if (pet) and.push({ pet });
  if (typeof q.category === "string" && q.category) and.push({ category: { slug: q.category } });
  if (typeof q.group === "string" && q.group) and.push({ category: { group: q.group, isActive: true } });
  if (typeof q.breed === "string" && q.breed) and.push({ tags: { has: q.breed } });
  if (typeof q.badge === "string" && q.badge) and.push({ badge: q.badge });
  if (q.onSale === "true") and.push({ maxDiscount: { gte: 8 } });
  const ids = list(q.ids);
  if (ids.length) and.push({ id: { in: ids.slice(0, 100) } });
  if (typeof q.q === "string" && q.q.trim()) {
    for (const word of q.q.trim().toLowerCase().split(/\s+/).slice(0, 6)) {
      and.push({
        OR: [
          { name: { contains: word, mode: "insensitive" } },
          { brand: { contains: word, mode: "insensitive" } },
          { flavour: { contains: word, mode: "insensitive" } },
          { lifeStage: { contains: word, mode: "insensitive" } },
          { badge: { contains: word, mode: "insensitive" } },
          { category: { name: { contains: word, mode: "insensitive" } } },
          { tags: { has: word } },
        ],
      });
    }
  }
  return { AND: and };
}

function refineWhere(q: Record<string, unknown>): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];
  const brand = list(q.brand);
  if (brand.length) and.push({ brand: { in: brand } });
  for (const f of ["lifeStage", "breedSize", "diet", "flavour"] as const) {
    const vals = list(q[f]);
    if (vals.length) and.push({ [f]: { in: vals } });
  }
  const prices = list(q.price)
    .map((r) => r.split("-").map(Number))
    .filter(([a, b]) => Number.isFinite(a) && (Number.isFinite(b) || b === undefined));
  if (prices.length) and.push({ OR: prices.map(([min, max]) => ({ minPrice: { gte: min, ...(Number.isFinite(max) ? { lte: max } : {}) } })) });
  if (q.minRating) and.push({ rating: { gte: Number(q.minRating) || 0 } });
  if (q.discounted === "true") and.push({ maxDiscount: { gte: 10 } });
  return and.length ? { AND: and } : {};
}

async function facets(where: Prisma.ProductWhereInput) {
  const fields = ["brand", "lifeStage", "breedSize", "diet", "flavour"] as const;
  const out: Record<string, { value: string; count: number }[]> = {};
  await Promise.all(
    fields.map(async (f) => {
      const rows = await prisma.product.groupBy({ by: [f], where, _count: { _all: true } });
      out[f] = rows
        .filter((r) => r[f])
        .map((r) => ({ value: r[f] as string, count: r._count._all }))
        .sort((a, b) => b.count - a.count);
    }),
  );
  return out;
}

catalog.get("/config", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=60").json(await storeConfig());
});

catalog.get("/categories", async (req, res) => {
  const pet = typeof req.query.pet === "string" ? PET_FROM_API[req.query.pet as keyof typeof PET_FROM_API] : undefined;
  const cats = await prisma.category.findMany({
    where: { isActive: true, ...(pet ? { pet } : {}) },
    orderBy: [{ pet: "asc" }, { sortOrder: "asc" }],
    include: { _count: { select: { products: { where: { status: "ACTIVE" } } } } },
  });
  res.set("Cache-Control", "public, max-age=60").json({ items: cats.map(categoryOut) });
});

catalog.get("/categories/:slug", async (req, res) => {
  const c = await prisma.category.findUnique({ where: { slug: String(req.params.slug) } });
  if (!c || !c.isActive) throw notFound("Category not found");
  res.json(categoryOut(c));
});

catalog.get("/breeds", async (_req, res) => {
  const breeds = await prisma.breed.findMany({ orderBy: [{ pet: "asc" }, { sortOrder: "asc" }] });
  const counts = await Promise.all(breeds.map((b) => prisma.product.count({ where: { status: "ACTIVE", tags: { has: b.slug } } })));
  res.set("Cache-Control", "public, max-age=60").json({ items: breeds.map((b, i) => ({ ...breedOut(b), productCount: counts[i] })) });
});

catalog.get("/products", async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const { page, limit, skip } = pageParams(q);
  const base = baseWhere(q);
  const where: Prisma.ProductWhereInput = { AND: [base, refineWhere(q)] };
  const orderBy = SORTS[String(q.sort)] ?? SORTS.popular;
  const [items, total, facetData] = await Promise.all([
    prisma.product.findMany({ where, orderBy, skip, take: limit, include }),
    prisma.product.count({ where }),
    q.facets === "false" ? Promise.resolve(undefined) : facets(base),
  ]);
  res.set("Cache-Control", "public, max-age=30").json({ items: items.map(productCard), total, page, limit, facets: facetData });
});

catalog.get("/products/:slug", async (req, res) => {
  const p = await prisma.product.findUnique({ where: { slug: String(req.params.slug) }, include });
  if (!p || p.status !== "ACTIVE") throw notFound("Product not found");
  const related = await prisma.product.findMany({
    where: { status: "ACTIVE", categoryId: p.categoryId, id: { not: p.id } },
    orderBy: { reviewCount: "desc" },
    take: 10,
    include,
  });
  const more = await prisma.product.findMany({
    where: { status: "ACTIVE", pet: p.pet, categoryId: { not: p.categoryId } },
    orderBy: { reviewCount: "desc" },
    take: 10,
    include,
  });
  // Public coupons with a badge that apply to this product (whole cart, its category, brand or the product itself).
  const now = new Date();
  const coupons = await prisma.coupon.findMany({
    where: {
      isActive: true,
      isPublic: true,
      badgeText: { not: null },
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    take: 20,
  });
  const offers = coupons
    .filter((c) => c.usageLimit === null || c.usedCount < c.usageLimit)
    .filter((c) => eligibleLines(c, [{ productId: p.id, categoryId: p.categoryId, brand: p.brand, price: 0, qty: 1 }]).length > 0)
    .slice(0, 3)
    .map((c) => ({ code: c.code, badge: c.badgeText!, description: c.description }));
  res
    .set("Cache-Control", "public, max-age=30")
    .json({ product: { ...productDetail(p), offers }, related: related.map(productCard), more: more.map(productCard) });
});

catalog.get("/products/:slug/reviews", async (req, res) => {
  const p = await prisma.product.findUnique({ where: { slug: String(req.params.slug) }, select: { id: true, rating: true, reviewCount: true } });
  if (!p) throw notFound("Product not found");
  const { limit, skip, page } = pageParams(req.query as Record<string, unknown>, 50);
  const where = { productId: p.id, status: "APPROVED" as const };
  const [items, dist] = await Promise.all([
    prisma.review.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit, include: { customer: { select: { name: true } } } }),
    prisma.review.groupBy({ by: ["rating"], where, _count: { _all: true } }),
  ]);
  const distribution = [5, 4, 3, 2, 1].map((r) => dist.find((d) => d.rating === r)?._count._all ?? 0);
  res.json({
    rating: p.rating,
    count: p.reviewCount,
    distribution,
    page,
    items: items.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      verified: r.verified,
      author: r.customer.name ? `${r.customer.name.split(" ")[0]} ${r.customer.name.split(" ")[1]?.[0] ?? ""}`.trim() : "Tailskart customer",
      createdAt: r.createdAt,
    })),
  });
});

catalog.get("/coupons", async (_req, res) => {
  const now = new Date();
  const items = await prisma.coupon.findMany({
    where: {
      isActive: true,
      isPublic: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  res.set("Cache-Control", "public, max-age=60").json({
    items: items
      .filter((c) => c.usageLimit === null || c.usedCount < c.usageLimit)
      .map((c) => ({ code: c.code, description: c.description, type: c.type, value: c.value, maxDiscount: c.maxDiscount, minOrder: c.minOrder, firstOrderOnly: c.firstOrderOnly, endsAt: c.endsAt, scope: c.scope, minQty: c.minQty, buyQty: c.buyQty, getQty: c.getQty, badgeText: c.badgeText })),
  });
});

catalog.get("/delivery/check", (req, res) => {
  const { pincode } = parse(z.object({ pincode: z.string().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode") }), req.query);
  res.json(deliveryInfo(pincode));
});

catalog.get("/settings", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=60").json(publicSettings(await getSettings()));
});

catalog.get("/pages/:slug", async (req, res) => {
  const page = await prisma.contentPage.findUnique({ where: { slug: String(req.params.slug) } });
  if (!page || !page.isPublished) throw notFound("Page not found");
  res.set("Cache-Control", "public, max-age=60").json({ slug: page.slug, title: page.title, body: page.body, updatedAt: page.updatedAt });
});
