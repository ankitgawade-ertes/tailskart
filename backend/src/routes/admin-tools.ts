// Admin tools: product import/export and bulk edits, inventory, store settings, reports,
// global search, notifications, editable content pages and GST invoices.
import { Router } from "express";
import type { OrderStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { PET_FROM_API, PET_TO_API, badRequest, notFound, orderNumber, parseOrderNumber, prisma, slugify } from "../lib/core.js";
import { pageParams, parse } from "../lib/http.js";
import { requireAdmin } from "../lib/auth.js";
import { deleteImage } from "../lib/services.js";
import { changeStock } from "../lib/stock.js";
import { getSettings, saveSettings } from "../lib/settings.js";

export const adminTools = Router();

const REVENUE: OrderStatus[] = ["PLACED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
const OPEN: OrderStatus[] = ["PENDING_PAYMENT", "PLACED", "PACKED"];

function denorm(variants: { price: number; mrp: number; isActive: boolean }[]) {
  const active = variants.filter((v) => v.isActive);
  const list = active.length ? active : variants;
  if (!list.length) return { minPrice: 0, maxDiscount: 0 };
  return {
    minPrice: Math.min(...list.map((v) => v.price)),
    maxDiscount: Math.max(0, ...list.map((v) => (v.mrp > v.price ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0))),
  };
}

async function refreshDenorm(tx: Prisma.TransactionClient, productId: string) {
  const vs = await tx.variant.findMany({ where: { productId } });
  await tx.product.update({ where: { id: productId }, data: denorm(vs) });
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const rupees = (paise: number) => (paise / 100).toFixed(2).replace(/\.00$/, "");

// ---------- Brands (for the product form's suggestions) ----------

adminTools.get("/brands", async (_req, res) => {
  const rows = await prisma.product.groupBy({ by: ["brand"], _count: { _all: true }, orderBy: { brand: "asc" } });
  res.json({ items: rows.map((r) => ({ name: r.brand, products: r._count._all })) });
});

adminTools.get("/tags", async (_req, res) => {
  const rows = await prisma.product.findMany({ select: { tags: true } });
  const counts = new Map<string, number>();
  for (const r of rows) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  res.json({ items: [...counts].sort((a, b) => b[1] - a[1]).map(([name, products]) => ({ name, products })) });
});

// ---------- Export / import ----------

export const IMPORT_COLUMNS = [
  "slug",
  "name",
  "brand",
  "pet",
  "category",
  "status",
  "description",
  "tags",
  "badge",
  "hsn",
  "gst_rate",
  "option1_name",
  "option1_value",
  "option2_name",
  "option2_value",
  "option3_name",
  "option3_value",
  "variant_label",
  "sku",
  "barcode",
  "price",
  "mrp",
  "stock",
  "weight_g",
  "low_stock_at",
  "location",
  "variant_active",
  "variant_image",
  "image_urls",
  "video_url",
] as const;

adminTools.get("/products/export", async (req, res) => {
  const ids = typeof req.query.ids === "string" && req.query.ids ? req.query.ids.split(",").slice(0, 2000) : null;
  const products = await prisma.product.findMany({
    where: ids ? { id: { in: ids } } : {},
    include: { variants: { orderBy: { sortOrder: "asc" } }, images: { orderBy: { sortOrder: "asc" } }, category: true },
    orderBy: { name: "asc" },
  });
  const lines = [IMPORT_COLUMNS.join(",")];
  for (const p of products) {
    p.variants.forEach((v, i) => {
      const opts = Object.entries((v.options ?? {}) as Record<string, string>);
      const row: Record<string, unknown> = {
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        pet: PET_TO_API[p.pet],
        category: p.category.slug,
        status: p.status,
        description: i === 0 ? p.description : "",
        tags: p.tags.join(", "),
        badge: p.badge ?? "",
        hsn: p.hsn ?? "",
        gst_rate: p.gstRate,
        variant_label: v.label,
        sku: v.sku ?? "",
        barcode: v.barcode ?? "",
        price: rupees(v.price),
        mrp: rupees(v.mrp),
        stock: v.stock,
        weight_g: v.grams ?? "",
        low_stock_at: v.lowStockAt,
        location: v.location ?? "",
        variant_active: v.isActive ? "yes" : "no",
        variant_image: v.imageUrl ?? "",
        image_urls: i === 0 ? p.images.map((im) => im.url).join(" | ") : "",
        video_url: i === 0 ? (p.videoUrl ?? "") : "",
      };
      opts.slice(0, 3).forEach(([k, val], n) => {
        row[`option${n + 1}_name`] = k;
        row[`option${n + 1}_value`] = val;
      });
      lines.push(IMPORT_COLUMNS.map((c) => csvCell(row[c])).join(","));
    });
  }
  res
    .set("Content-Type", "text/csv; charset=utf-8")
    .set("Content-Disposition", `attachment; filename="tailskart-products-${new Date().toISOString().slice(0, 10)}.csv"`)
    .send("﻿" + lines.join("\r\n"));
});

const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]).optional().transform((v) => (v === null || v === undefined ? "" : String(v).trim()));
const importRow = z.object(Object.fromEntries(IMPORT_COLUMNS.map((c) => [c, cell])) as Record<(typeof IMPORT_COLUMNS)[number], typeof cell>);

const toPaise = (s: string) => {
  const n = Number(s.replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
const toInt = (s: string, fallback: number) => (s === "" ? fallback : Number.parseInt(s.replace(/,/g, ""), 10));
const yes = (s: string, fallback = true) => (s === "" ? fallback : /^(y|yes|true|1|active)$/i.test(s));

adminTools.post("/products/import", requireAdmin("ADMIN"), async (req, res) => {
  const { rows, dryRun } = parse(z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1, "The file has no rows").max(3000), dryRun: z.boolean().default(true) }), req.body);
  const actor = req.admin!.email;
  const categories = await prisma.category.findMany();
  const errors: { row: number; message: string }[] = [];

  type V = {
    row: number;
    label: string;
    options: Record<string, string>;
    sku: string | null;
    barcode: string | null;
    price: number;
    mrp: number;
    stock: number;
    grams: number | null;
    lowStockAt: number;
    location: string | null;
    isActive: boolean;
    imageUrl: string | null;
  };
  type P = {
    row: number;
    slug: string;
    fields: Omit<Prisma.ProductUncheckedCreateInput, "slug" | "minPrice" | "maxDiscount">;
    images: string[] | null;
    variants: V[];
  };
  const products = new Map<string, P>();
  const skus = new Map<string, number>();

  rows.forEach((raw, idx) => {
    const n = idx + 2; // spreadsheet row number (row 1 is the header)
    const r = importRow.safeParse(raw);
    if (!r.success) return void errors.push({ row: n, message: "Row could not be read" });
    const d = r.data;
    const slug = slugify(d.slug || `${d.brand} ${d.name}`);
    if (!slug) return void errors.push({ row: n, message: "Add a name and brand (or a slug)" });
    const err = (message: string) => errors.push({ row: n, message });

    let p = products.get(slug);
    if (!p) {
      if (!d.name || d.name.length < 2) return void err("Name is missing");
      if (!d.brand) return void err("Brand is missing");
      const pet = PET_FROM_API[d.pet.toLowerCase() as keyof typeof PET_FROM_API];
      if (!pet) return void err(`Pet must be dog, cat, small or parent (got "${d.pet}")`);
      const cat = categories.find((c) => c.slug === d.category.toLowerCase() || c.name.toLowerCase() === d.category.toLowerCase());
      if (!cat) return void err(`Category "${d.category}" not found — use a category slug from Admin → Categories`);
      const status = (d.status || "DRAFT").toUpperCase();
      if (!["DRAFT", "ACTIVE", "ARCHIVED"].includes(status)) return void err("Status must be DRAFT, ACTIVE or ARCHIVED");
      const gst = toInt(d.gst_rate, 18);
      if (![0, 5, 12, 18, 28].includes(gst)) return void err("GST rate must be 0, 5, 12, 18 or 28");
      const badge = d.badge && ["Bestseller", "New", "Tailskart Pick", "Deal"].includes(d.badge) ? d.badge : null;
      const options: { name: string; values: string[] }[] = [];
      p = {
        row: n,
        slug,
        fields: {
          name: d.name.slice(0, 160),
          brand: d.brand.slice(0, 80),
          pet,
          categoryId: cat.id,
          status: status as "DRAFT",
          description: d.description.slice(0, 10000),
          tags: d.tags ? d.tags.split(/[,|]/).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 30) : [],
          badge,
          hsn: d.hsn || null,
          gstRate: gst,
          videoUrl: /^https?:\/\//.test(d.video_url) ? d.video_url : null,
          options,
        },
        images: d.image_urls ? d.image_urls.split(/\s*\|\s*|\s*\n\s*/).filter((u) => /^https?:\/\//.test(u)).slice(0, 10) : null,
        variants: [],
      };
      products.set(slug, p);
    }

    const opts: Record<string, string> = {};
    for (const k of [1, 2, 3] as const) {
      const name = d[`option${k}_name`];
      const value = d[`option${k}_value`];
      if (name && value) {
        opts[name] = value;
        const list = p.fields.options as { name: string; values: string[] }[];
        const o = list.find((x) => x.name === name) ?? (list.push({ name, values: [] }), list[list.length - 1]);
        if (!o.values.includes(value)) o.values.push(value);
      }
    }
    const label = (d.variant_label || Object.values(opts).join(" / ") || "Standard").slice(0, 40);
    const price = toPaise(d.price);
    const mrp = d.mrp ? toPaise(d.mrp) : price;
    if (!Number.isFinite(price) || price < 100) return void err("Price must be a number of at least 1 (in rupees)");
    if (!Number.isFinite(mrp) || mrp < price) return void err("MRP must be a number and not less than the price");
    const stock = toInt(d.stock, 0);
    if (!Number.isFinite(stock) || stock < 0) return void err("Stock must be 0 or more");
    if (d.sku) {
      if (skus.has(d.sku)) return void err(`SKU ${d.sku} is repeated (also on row ${skus.get(d.sku)})`);
      skus.set(d.sku, n);
    }
    if (p.variants.some((v) => v.label === label)) return void err(`Variant "${label}" appears twice for ${p.fields.name}`);
    const grams = d.weight_g ? toInt(d.weight_g, 0) : null;
    p.variants.push({
      row: n,
      label,
      options: opts,
      sku: d.sku || null,
      barcode: d.barcode || null,
      price,
      mrp,
      stock,
      grams: grams && grams > 0 ? grams : null,
      lowStockAt: Math.max(0, toInt(d.low_stock_at, 5) || 0),
      location: d.location || null,
      isActive: yes(d.variant_active),
      imageUrl: /^https?:\/\//.test(d.variant_image) ? d.variant_image : null,
    });
  });

  const slugs = [...products.keys()];
  const existing = await prisma.product.findMany({ where: { slug: { in: slugs } }, include: { variants: true } });
  // SKUs must not clash with variants of other products.
  if (skus.size) {
    const clash = await prisma.variant.findMany({ where: { sku: { in: [...skus.keys()] } }, include: { product: { select: { slug: true } } } });
    for (const v of clash) {
      const row = skus.get(v.sku!)!;
      const p = [...products.values()].find((x) => x.variants.some((y) => y.sku === v.sku));
      if (p && p.slug !== v.product.slug) errors.push({ row, message: `SKU ${v.sku} already belongs to another product (${v.product.slug})` });
    }
  }

  const summary = {
    rows: rows.length,
    products: products.size,
    newProducts: slugs.filter((s) => !existing.some((e) => e.slug === s)).length,
    updatedProducts: existing.length,
    variants: [...products.values()].reduce((s, p) => s + p.variants.length, 0),
  };
  errors.sort((a, b) => a.row - b.row);
  if (dryRun || errors.length) return res.json({ ok: errors.length === 0, applied: false, summary, errors: errors.slice(0, 200) });

  for (const p of products.values()) {
    if (!p.variants.length) continue;
    await prisma.$transaction(
      async (tx) => {
        const ex = existing.find((e) => e.slug === p.slug);
        let productId: string;
        if (ex) {
          productId = ex.id;
          await tx.product.update({ where: { id: ex.id }, data: p.fields });
        } else {
          const created = await tx.product.create({ data: { ...p.fields, slug: p.slug, ...denorm(p.variants) } });
          productId = created.id;
        }
        const current = ex?.variants ?? [];
        for (const [i, v] of p.variants.entries()) {
          const { row: _row, stock, ...data } = v;
          const match = current.find((c) => (v.sku && c.sku === v.sku) || c.label === v.label);
          if (match) {
            await tx.variant.update({ where: { id: match.id }, data: { ...data, sortOrder: i } });
            await changeStock(tx, match.id, { set: stock }, "IMPORT", { actor, note: "Spreadsheet import" });
          } else {
            const nv = await tx.variant.create({ data: { ...data, stock: 0, sortOrder: i, productId } });
            await changeStock(tx, nv.id, { set: stock }, "IMPORT", { actor, note: "Spreadsheet import" });
          }
        }
        if (p.images) {
          await tx.productImage.deleteMany({ where: { productId } });
          await tx.productImage.createMany({ data: p.images.map((url, i) => ({ productId, url, alt: p.fields.name as string, sortOrder: i })) });
        }
        await refreshDenorm(tx, productId);
      },
      { timeout: 20_000 },
    );
  }
  res.json({ ok: true, applied: true, summary, errors: [] });
});

// ---------- Bulk actions ----------

adminTools.post("/products/bulk", requireAdmin("ADMIN"), async (req, res) => {
  const d = parse(
    z.discriminatedUnion("action", [
      z.object({ action: z.literal("status"), ids: z.array(z.string()).min(1).max(500), status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]) }),
      z.object({ action: z.literal("delete"), ids: z.array(z.string()).min(1).max(500) }),
      z.object({ action: z.literal("price"), ids: z.array(z.string()).min(1).max(500), percent: z.number().min(-90).max(500).refine((v) => v !== 0, "Enter a % change") }),
      z.object({ action: z.literal("stock"), ids: z.array(z.string()).min(1).max(500), mode: z.enum(["set", "add"]), qty: z.number().int().min(-100_000).max(100_000) }),
      z.object({ action: z.literal("tag"), ids: z.array(z.string()).min(1).max(500), mode: z.enum(["add", "remove"]), tag: z.string().trim().toLowerCase().min(1).max(40) }),
      z.object({ action: z.literal("category"), ids: z.array(z.string()).min(1).max(500), categoryId: z.string().min(1) }),
    ]),
    req.body,
  );
  const actor = req.admin!.email;
  let changed = 0;

  if (d.action === "status") {
    changed = (await prisma.product.updateMany({ where: { id: { in: d.ids } }, data: { status: d.status } })).count;
  } else if (d.action === "category") {
    if (!(await prisma.category.findUnique({ where: { id: d.categoryId } }))) throw badRequest("Category not found");
    changed = (await prisma.product.updateMany({ where: { id: { in: d.ids } }, data: { categoryId: d.categoryId } })).count;
  } else if (d.action === "delete") {
    const ps = await prisma.product.findMany({ where: { id: { in: d.ids } }, include: { images: true } });
    changed = (await prisma.product.deleteMany({ where: { id: { in: d.ids } } })).count;
    await Promise.all(ps.flatMap((p) => p.images.map((i) => deleteImage(i.key))));
  } else if (d.action === "tag") {
    const ps = await prisma.product.findMany({ where: { id: { in: d.ids } }, select: { id: true, tags: true } });
    await prisma.$transaction(
      ps.map((p) =>
        prisma.product.update({
          where: { id: p.id },
          data: { tags: d.mode === "add" ? [...new Set([...p.tags, d.tag])] : p.tags.filter((t) => t !== d.tag) },
        }),
      ),
    );
    changed = ps.length;
  } else {
    const variants = await prisma.variant.findMany({ where: { productId: { in: d.ids } } });
    await prisma.$transaction(
      async (tx) => {
        for (const v of variants) {
          if (d.action === "price") {
            // Round to the nearest rupee; raise MRP if the new price goes above it.
            const price = Math.max(100, Math.round((v.price * (1 + d.percent / 100)) / 100) * 100);
            await tx.variant.update({ where: { id: v.id }, data: { price, mrp: Math.max(v.mrp, price) } });
          } else {
            await changeStock(tx, v.id, d.mode === "set" ? { set: Math.max(0, d.qty) } : { add: d.qty }, "ADJUST", { actor, note: "Bulk stock update" });
          }
        }
        for (const id of new Set(variants.map((v) => v.productId))) await refreshDenorm(tx, id);
      },
      { timeout: 30_000 },
    );
    changed = new Set(variants.map((v) => v.productId)).size;
  }
  res.json({ ok: true, changed });
});

// ---------- Inventory ----------

async function committedByVariant(variantIds?: string[]) {
  const rows = await prisma.orderItem.groupBy({
    by: ["variantId"],
    where: { order: { status: { in: OPEN } }, ...(variantIds ? { variantId: { in: variantIds } } : { variantId: { not: null } }) },
    _sum: { qty: true },
  });
  return new Map(rows.map((r) => [r.variantId!, r._sum.qty ?? 0]));
}

adminTools.get("/inventory", async (req, res) => {
  const q = req.query as Record<string, string>;
  const { page, limit, skip } = pageParams(q, 200);
  const search = q.q?.trim();
  const variants = await prisma.variant.findMany({
    where: {
      product: { status: q.includeArchived === "true" ? undefined : { not: "ARCHIVED" } },
      ...(search
        ? {
            OR: [
              { sku: { contains: search, mode: "insensitive" } },
              { barcode: search },
              { label: { contains: search, mode: "insensitive" } },
              { product: { name: { contains: search, mode: "insensitive" } } },
              { product: { brand: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { product: { select: { id: true, name: true, brand: true, status: true, images: { take: 1, orderBy: { sortOrder: "asc" } } } } },
    orderBy: [{ product: { name: "asc" } }, { sortOrder: "asc" }],
  });
  const committed = await committedByVariant();
  let rows = variants.map((v) => {
    const c = committed.get(v.id) ?? 0;
    return {
      variantId: v.id,
      productId: v.productId,
      product: v.product.name,
      brand: v.product.brand,
      productStatus: v.product.status,
      image: v.imageUrl ?? v.product.images[0]?.url ?? null,
      label: v.label,
      sku: v.sku,
      barcode: v.barcode,
      location: v.location,
      price: v.price,
      isActive: v.isActive,
      available: v.stock,
      committed: c,
      onHand: v.stock + c,
      lowStockAt: v.lowStockAt,
      status: v.stock === 0 ? "out" : v.stock <= v.lowStockAt ? "low" : "ok",
    };
  });
  const summary = {
    skus: rows.length,
    low: rows.filter((r) => r.status === "low").length,
    out: rows.filter((r) => r.status === "out").length,
    units: rows.reduce((s, r) => s + r.onHand, 0),
    committed: rows.reduce((s, r) => s + r.committed, 0),
    value: rows.reduce((s, r) => s + r.onHand * r.price, 0),
  };
  if (q.filter === "low") rows = rows.filter((r) => r.status === "low");
  else if (q.filter === "out") rows = rows.filter((r) => r.status === "out");
  else if (q.filter === "attention") rows = rows.filter((r) => r.status !== "ok");
  res.json({ items: rows.slice(skip, skip + limit), total: rows.length, page, limit, summary });
});

adminTools.post("/inventory/:variantId/adjust", async (req, res) => {
  const d = parse(
    z.object({
      mode: z.enum(["add", "set"]),
      qty: z.number().int().min(-100_000).max(100_000),
      reason: z.enum(["RESTOCK", "ADJUST"]).default("RESTOCK"),
      note: z.string().trim().max(200).optional(),
    }),
    req.body,
  );
  if (d.mode === "set" && d.qty < 0) throw badRequest("Stock can't be negative");
  const id = String(req.params.variantId);
  if (!(await prisma.variant.findUnique({ where: { id } }))) throw notFound("Item not found");
  const stock = await prisma.$transaction((tx) =>
    changeStock(tx, id, d.mode === "set" ? { set: d.qty } : { add: d.qty }, d.reason, { note: d.note || null, actor: req.admin!.email }),
  );
  res.json({ ok: true, stock });
});

adminTools.patch("/inventory/:variantId", async (req, res) => {
  const d = parse(
    z.object({
      lowStockAt: z.number().int().min(0).max(100_000).optional(),
      location: z.string().trim().max(60).nullable().optional().transform((v) => (v === undefined ? undefined : v || null)),
      barcode: z.string().trim().max(40).nullable().optional().transform((v) => (v === undefined ? undefined : v || null)),
    }),
    req.body,
  );
  const v = await prisma.variant.update({ where: { id: String(req.params.variantId) }, data: d });
  res.json({ ok: true, lowStockAt: v.lowStockAt, location: v.location, barcode: v.barcode });
});

adminTools.get("/inventory/:variantId/movements", async (req, res) => {
  const items = await prisma.stockMovement.findMany({ where: { variantId: String(req.params.variantId) }, orderBy: { createdAt: "desc" }, take: 200 });
  res.json({ items });
});

// ---------- Settings ----------

adminTools.get("/settings", async (_req, res) => {
  res.json(await getSettings());
});

adminTools.put("/settings", requireAdmin("ADMIN"), async (req, res) => {
  try {
    res.json(await saveSettings(req.body, req.admin!.email));
  } catch (e) {
    if (e instanceof z.ZodError) throw badRequest(e.issues[0]?.message ?? "Check the settings", "validation_error", e.issues);
    throw e;
  }
});

// ---------- Reports ----------

adminTools.get("/reports", async (req, res) => {
  const q = parse(z.object({ days: z.coerce.number().int().min(1).max(366).default(30) }), req.query);
  const since = new Date(Date.now() - q.days * 864e5);
  const orders = await prisma.order.findMany({
    where: { status: { in: REVENUE }, createdAt: { gte: since } },
    select: { id: true, total: true, discount: true, pointsRedeemed: true, customerId: true, createdAt: true, couponCode: true, items: true },
  });
  const products = await prisma.product.findMany({ select: { id: true, categoryId: true, category: { select: { name: true } } } });
  const catOf = new Map(products.map((p) => [p.id, p.category.name]));

  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const units = orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
  const customerIds = [...new Set(orders.map((o) => o.customerId))];
  const lifetime = await prisma.order.groupBy({ by: ["customerId"], where: { customerId: { in: customerIds }, status: { in: REVENUE } }, _count: { _all: true } });
  const repeat = lifetime.filter((l) => l._count._all >= 2).length;
  const newCustomers = await prisma.customer.count({ where: { createdAt: { gte: since } } });

  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (let i = q.days - 1; i >= 0; i--) byDay.set(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), { revenue: 0, orders: 0 });
  const byCategory = new Map<string, { revenue: number; units: number }>();
  const byBrand = new Map<string, { revenue: number; units: number }>();
  const byProduct = new Map<string, { name: string; brand: string; revenue: number; units: number }>();
  const coupons = new Map<string, { orders: number; discount: number }>();
  for (const o of orders) {
    const day = byDay.get(o.createdAt.toISOString().slice(0, 10));
    if (day) {
      day.revenue += o.total;
      day.orders += 1;
    }
    if (o.couponCode) {
      const c = coupons.get(o.couponCode) ?? { orders: 0, discount: 0 };
      c.orders += 1;
      c.discount += o.discount;
      coupons.set(o.couponCode, c);
    }
    for (const it of o.items) {
      const amt = it.price * it.qty;
      const cat = (it.productId && catOf.get(it.productId)) || "Other";
      const c = byCategory.get(cat) ?? { revenue: 0, units: 0 };
      c.revenue += amt;
      c.units += it.qty;
      byCategory.set(cat, c);
      const b = byBrand.get(it.brand) ?? { revenue: 0, units: 0 };
      b.revenue += amt;
      b.units += it.qty;
      byBrand.set(it.brand, b);
      const key = it.productId ?? it.slug;
      const p = byProduct.get(key) ?? { name: it.name, brand: it.brand, revenue: 0, units: 0 };
      p.revenue += amt;
      p.units += it.qty;
      byProduct.set(key, p);
    }
  }
  const sortRev = <T extends { revenue: number }>(m: Map<string, T>) => [...m].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue);

  // Stock and reorder suggestions use the last 30 days of sales.
  const salesSince = new Date(Date.now() - 30 * 864e5);
  const sold = await prisma.orderItem.groupBy({
    by: ["variantId"],
    where: { variantId: { not: null }, order: { status: { in: REVENUE }, createdAt: { gte: salesSince } } },
    _sum: { qty: true },
  });
  const soldMap = new Map(sold.map((s) => [s.variantId!, s._sum.qty ?? 0]));
  const variants = await prisma.variant.findMany({
    where: { isActive: true, product: { status: "ACTIVE" } },
    include: { product: { select: { id: true, name: true, brand: true } } },
  });
  const stockValue = variants.reduce((s, v) => s + v.stock * v.price, 0);
  const stockValueMrp = variants.reduce((s, v) => s + v.stock * v.mrp, 0);
  const reorder = variants
    .map((v) => {
      const sold30 = soldMap.get(v.id) ?? 0;
      const perDay = sold30 / 30;
      const daysLeft = perDay > 0 ? Math.floor(v.stock / perDay) : null;
      const suggested = Math.max(0, Math.ceil(perDay * 30) - v.stock, v.stock <= v.lowStockAt ? v.lowStockAt * 2 - v.stock : 0);
      return { variantId: v.id, productId: v.productId, product: v.product.name, brand: v.product.brand, label: v.label, sku: v.sku, stock: v.stock, lowStockAt: v.lowStockAt, sold30, daysLeft, suggested };
    })
    .filter((r) => r.stock <= r.lowStockAt || (r.daysLeft !== null && r.daysLeft < 14))
    .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999) || a.stock - b.stock)
    .slice(0, 100);

  const points = await prisma.pointTransaction.groupBy({ by: ["reason"], where: { createdAt: { gte: since } }, _sum: { points: true } });

  res.json({
    days: q.days,
    summary: {
      revenue,
      orders: orders.length,
      aov: orders.length ? Math.round(revenue / orders.length) : 0,
      units,
      customers: customerIds.length,
      repeatCustomers: repeat,
      repeatRate: customerIds.length ? Math.round((repeat / customerIds.length) * 100) : 0,
      newCustomers,
      discounts: orders.reduce((s, o) => s + o.discount, 0),
      pointsRedeemed: orders.reduce((s, o) => s + o.pointsRedeemed, 0),
    },
    daily: [...byDay].map(([date, v]) => ({ date, ...v })),
    byCategory: sortRev(byCategory),
    byBrand: sortRev(byBrand),
    topProducts: sortRev(byProduct).slice(0, 20),
    coupons: [...coupons].map(([code, v]) => ({ code, ...v })).sort((a, b) => b.orders - a.orders),
    stock: { value: stockValue, valueMrp: stockValueMrp, skus: variants.length, units: variants.reduce((s, v) => s + v.stock, 0) },
    reorder,
    points: Object.fromEntries(points.map((p) => [p.reason, p._sum.points ?? 0])),
  });
});

// ---------- Global search ----------

adminTools.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) return res.json({ orders: [], customers: [], products: [] });
  const seq = parseOrderNumber(q.toUpperCase()) ?? (/^\d{1,7}$/.test(q) ? Number(q) : null);
  const digits = q.replace(/\D/g, "");
  const [orders, customers, products] = await Promise.all([
    prisma.order.findMany({
      where: {
        OR: [
          ...(seq !== null ? [{ seq }] : []),
          ...(digits.length >= 4 ? [{ customer: { phone: { contains: digits } } }] : []),
          { customer: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      },
      include: { customer: { select: { name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.customer.findMany({
      where: {
        OR: [
          ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { companyName: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 6,
    }),
    prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
          { variants: { some: { OR: [{ sku: { contains: q, mode: "insensitive" } }, { barcode: q }] } } },
        ],
      },
      include: { images: { take: 1, orderBy: { sortOrder: "asc" } } },
      take: 6,
    }),
  ]);
  res.json({
    orders: orders.map((o) => ({ id: o.id, number: orderNumber(o.seq), status: o.status, total: o.total, customer: o.customer.name ?? o.customer.phone, createdAt: o.createdAt })),
    customers: customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email, companyName: c.companyName })),
    products: products.map((p) => ({ id: p.id, name: p.name, brand: p.brand, status: p.status, image: p.images[0]?.url ?? null })),
  });
});

// ---------- Notifications ----------

adminTools.get("/notifications", async (req, res) => {
  const admin = await prisma.adminUser.findUnique({ where: { id: req.admin!.id }, select: { notificationsSeenAt: true } });
  const seenAt = admin?.notificationsSeenAt ?? new Date(0);
  const [orders, prescriptions, appointments, messages, reviews, variants] = await Promise.all([
    prisma.order.findMany({ where: { status: "PLACED" }, orderBy: { placedAt: "desc" }, take: 15, include: { customer: { select: { name: true, phone: true } } } }),
    prisma.prescriptionRequest.findMany({ where: { status: "RECEIVED" }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.appointmentRequest.findMany({ where: { status: "REQUESTED" }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.contactMessage.findMany({ where: { status: "NEW" }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.review.count({ where: { status: "PENDING" } }),
    prisma.variant.findMany({ where: { isActive: true, product: { status: "ACTIVE" } }, select: { stock: true, lowStockAt: true, updatedAt: true } }),
  ]);
  const low = variants.filter((v) => v.stock <= v.lowStockAt);
  type Item = { type: string; title: string; detail: string; href: string; at: Date };
  const items: Item[] = [
    ...orders.map((o) => ({
      type: "order",
      title: `New order ${orderNumber(o.seq)}`,
      detail: `${o.customer.name ?? o.customer.phone} · ₹${Math.round(o.total / 100).toLocaleString("en-IN")}`,
      href: `/orders/${o.id}`,
      at: o.placedAt ?? o.createdAt,
    })),
    ...prescriptions.map((p) => ({ type: "prescription", title: `Prescription PK-${1000 + p.seq}`, detail: `${p.petName} · ${p.branch}`, href: "/prescriptions", at: p.createdAt })),
    ...appointments.map((a) => ({ type: "appointment", title: `Appointment request AM-${1000 + a.seq}`, detail: `${a.name} · ${a.petName}`, href: "/appointments", at: a.createdAt })),
    ...messages.map((m) => ({ type: "message", title: `Message from ${m.name}`, detail: m.topic, href: "/messages", at: m.createdAt })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  res.json({
    seenAt,
    unread: items.filter((i) => i.at > seenAt).length,
    items: items.slice(0, 25).map((i) => ({ ...i, unread: i.at > seenAt })),
    counts: { orders: orders.length, prescriptions: prescriptions.length, appointments: appointments.length, messages: messages.length, reviews, lowStock: low.length },
  });
});

adminTools.post("/notifications/seen", async (req, res) => {
  await prisma.adminUser.update({ where: { id: req.admin!.id }, data: { notificationsSeenAt: new Date() } });
  res.json({ ok: true });
});

// ---------- Content pages ----------

const pageSchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().max(100_000).default(""),
  isPublished: z.boolean().default(true),
});

adminTools.get("/pages", async (_req, res) => {
  const items = await prisma.contentPage.findMany({ orderBy: { slug: "asc" }, select: { slug: true, title: true, isPublished: true, updatedAt: true, updatedBy: true } });
  res.json({ items });
});

adminTools.get("/pages/:slug", async (req, res) => {
  const p = await prisma.contentPage.findUnique({ where: { slug: String(req.params.slug) } });
  if (!p) throw notFound("Page not found");
  res.json(p);
});

adminTools.put("/pages/:slug", requireAdmin("ADMIN"), async (req, res) => {
  const slug = slugify(String(req.params.slug));
  if (!slug) throw badRequest("Enter a page address");
  const d = parse(pageSchema, req.body);
  const p = await prisma.contentPage.upsert({ where: { slug }, create: { slug, ...d, updatedBy: req.admin!.email }, update: { ...d, updatedBy: req.admin!.email } });
  res.json(p);
});

adminTools.delete("/pages/:slug", requireAdmin("ADMIN"), async (req, res) => {
  await prisma.contentPage.deleteMany({ where: { slug: String(req.params.slug) } });
  res.status(204).end();
});

// ---------- GST invoice ----------

/** Splits a GST-inclusive amount into taxable value and tax. */
const splitTax = (gross: number, rate: number) => {
  const taxable = Math.round((gross * 100) / (100 + rate));
  return { taxable, tax: gross - taxable };
};

adminTools.get("/orders/:id/invoice", async (req, res) => {
  const o = await prisma.order.findUnique({ where: { id: String(req.params.id) }, include: { items: true, customer: true } });
  if (!o) throw notFound("Order not found");
  if (o.status === "PENDING_PAYMENT") throw badRequest("This order hasn't been placed yet");
  const s = await getSettings();
  const address = o.address as Record<string, string>;
  const interState = !!address.state && !!s.store.state && address.state.trim().toLowerCase() !== s.store.state.trim().toLowerCase();

  // Spread order-level discounts (coupon + points) across lines in proportion to their value.
  const reduction = o.discount + o.pointsRedeemed * 100;
  const gross = o.items.map((i) => i.price * i.qty);
  const sumGross = gross.reduce((a, b) => a + b, 0) || 1;
  let left = reduction;
  const lines = o.items.map((it, idx) => {
    const share = idx === o.items.length - 1 ? left : Math.round((gross[idx] * reduction) / sumGross);
    left -= share;
    const net = gross[idx] - share;
    const { taxable, tax } = splitTax(net, it.gstRate);
    return {
      name: `${it.name} — ${it.variantLabel}`,
      brand: it.brand,
      sku: it.sku,
      hsn: it.hsn,
      qty: it.qty,
      rate: it.price,
      gross: gross[idx],
      discount: share,
      taxable,
      gstRate: it.gstRate,
      cgst: interState ? 0 : Math.floor(tax / 2),
      sgst: interState ? 0 : tax - Math.floor(tax / 2),
      igst: interState ? tax : 0,
      total: net,
    };
  });
  if (o.shippingFee > 0) {
    const { taxable, tax } = splitTax(o.shippingFee, 18);
    lines.push({
      name: "Delivery charges",
      brand: "",
      sku: null,
      hsn: "996812",
      qty: 1,
      rate: o.shippingFee,
      gross: o.shippingFee,
      discount: 0,
      taxable,
      gstRate: 18,
      cgst: interState ? 0 : Math.floor(tax / 2),
      sgst: interState ? 0 : tax - Math.floor(tax / 2),
      igst: interState ? tax : 0,
      total: o.shippingFee,
    });
  }
  const sum = (k: "taxable" | "cgst" | "sgst" | "igst" | "total") => lines.reduce((a, l) => a + l[k], 0);
  res.json({
    invoiceNo: `${s.store.invoicePrefix}/${o.createdAt.getFullYear()}/${String(o.seq).padStart(6, "0")}`,
    orderNumber: orderNumber(o.seq),
    date: o.placedAt ?? o.createdAt,
    seller: s.store,
    buyer: {
      name: address.name ?? o.customer.name,
      phone: address.phone ?? o.customer.phone,
      email: o.customer.email,
      company: o.billingCompany ?? o.customer.companyName,
      gstin: o.billingGstin ?? o.customer.gstin,
      address,
    },
    interState,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    couponCode: o.couponCode,
    pointsRedeemed: o.pointsRedeemed,
    lines,
    totals: { taxable: sum("taxable"), cgst: sum("cgst"), sgst: sum("sgst"), igst: sum("igst"), total: sum("total") },
    orderTotal: o.total,
  });
});
