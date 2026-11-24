import { Router } from "express";
import multer from "multer";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { PET_FROM_API, badRequest, conflict, notFound, prisma, slugify } from "../lib/core.js";
import { pageParams, parse } from "../lib/http.js";
import { requireAdmin } from "../lib/auth.js";
import { deleteImage, isAllowedImage, storeImage } from "../lib/services.js";
import { breedOut, categoryOut, productDetail, variantOut } from "../lib/serialize.js";
import { changeStock, logMovement } from "../lib/stock.js";

export const adminCatalog = Router();

const pet = z.enum(["dog", "cat", "small", "parent"]).transform((p) => PET_FROM_API[p]);
const optStr = (max = 80) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

const productSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().max(140).optional(),
  brand: z.string().trim().min(1).max(80),
  pet,
  categoryId: z.string().min(1),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  description: z.string().trim().max(10000).default(""),
  highlights: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  specs: z.array(z.tuple([z.string().trim().min(1).max(60), z.string().trim().min(1).max(200)])).max(30).default([]),
  badge: z.enum(["Bestseller", "New", "Tailskart Pick", "Deal"]).optional().nullable().or(z.literal("")).transform((v) => v || null),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(30).default([]),
  lifeStage: optStr(),
  breedSize: optStr(),
  diet: optStr(),
  flavour: optStr(),
  artKind: z.enum(["bag", "pouch", "jar", "treat", "toy", "collar", "bed", "bottle", "litter", "bowl", "tee"]).default("bag"),
  tint: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#f3ece1"),
  options: z
    .array(z.object({ name: z.string().trim().min(1).max(30), values: z.array(z.string().trim().min(1).max(40)).min(1).max(30) }))
    .max(3)
    .default([]),
  videoUrl: z.string().url().max(500).optional().nullable().or(z.literal("")).transform((v) => v || null),
  hsn: z.string().trim().max(10).optional().nullable().transform((v) => v || null),
  gstRate: z.number().int().refine((v) => [0, 5, 12, 18, 28].includes(v), "GST must be 0, 5, 12, 18 or 28%").default(18),
  variants: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().trim().min(1).max(40),
        sku: optStr(60),
        price: z.number().int().min(100, "Price must be at least ₹1"),
        mrp: z.number().int().min(100),
        grams: z.number().int().positive().optional().nullable(),
        stock: z.number().int().min(0).max(1_000_000),
        isActive: z.boolean().default(true),
        barcode: optStr(40),
        options: z.record(z.string().max(30), z.string().max(40)).default({}),
        imageUrl: z.string().url().max(500).optional().nullable().or(z.literal("")).transform((v) => v || null),
        lowStockAt: z.number().int().min(0).max(100_000).default(5),
        location: optStr(60),
      }),
    )
    .min(1, "Add at least one size/variant")
    .max(100)
    .refine((vs) => vs.every((v) => v.mrp >= v.price), "MRP must be greater than or equal to the selling price"),
  images: z.array(z.object({ url: z.string().url(), key: z.string().optional().nullable(), alt: z.string().max(160).default("") })).max(10).default([]),
});

const include = { variants: { orderBy: { sortOrder: "asc" } }, images: { orderBy: { sortOrder: "asc" } }, category: true } as const;

function denorm(variants: { price: number; mrp: number; isActive: boolean }[]) {
  const active = variants.filter((v) => v.isActive);
  const list = active.length ? active : variants;
  return {
    minPrice: Math.min(...list.map((v) => v.price)),
    maxDiscount: Math.max(0, ...list.map((v) => (v.mrp > v.price ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0))),
  };
}

const adminProduct = (p: Prisma.ProductGetPayload<{ include: typeof include }>) => ({
  ...productDetail(p),
  status: p.status,
  categoryId: p.categoryId,
  variants: p.variants.map((v) => ({
    ...variantOut(v),
    isActive: v.isActive,
    barcode: v.barcode,
    options: v.options,
    imageUrl: v.imageUrl,
    lowStockAt: v.lowStockAt,
    location: v.location,
  })),
  options: p.options,
  videoUrl: p.videoUrl,
  hsn: p.hsn,
  gstRate: p.gstRate,
  images: p.images.map((i) => ({ id: i.id, url: i.url, key: i.key, alt: i.alt })),
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

adminCatalog.get("/products", async (req, res) => {
  const q = req.query as Record<string, string>;
  const { page, limit, skip } = pageParams(q, 100);
  const where: Prisma.ProductWhereInput = {
    ...(q.status ? { status: q.status as Prisma.EnumProductStatusFilter["equals"] } : {}),
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.pet && q.pet in PET_FROM_API ? { pet: PET_FROM_API[q.pet as keyof typeof PET_FROM_API] } : {}),
    ...(q.lowStock === "true" ? { variants: { some: { stock: { lte: 5 }, isActive: true } } } : {}),
    ...(q.brand ? { brand: { equals: q.brand, mode: "insensitive" } } : {}),
    ...(q.tag ? { tags: { has: q.tag.toLowerCase() } } : {}),
    ...(q.q
      ? {
          OR: [
            { name: { contains: q.q, mode: "insensitive" } },
            { brand: { contains: q.q, mode: "insensitive" } },
            { variants: { some: { sku: { contains: q.q, mode: "insensitive" } } } },
            { variants: { some: { barcode: q.q } } },
            { tags: { has: q.q.toLowerCase() } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, include, orderBy: { updatedAt: "desc" }, skip, take: limit }),
    prisma.product.count({ where }),
  ]);
  res.json({ items: items.map(adminProduct), total, page, limit });
});

adminCatalog.get("/products/:id", async (req, res) => {
  const p = await prisma.product.findUnique({ where: { id: String(req.params.id) }, include });
  if (!p) throw notFound("Product not found");
  res.json(adminProduct(p));
});

adminCatalog.post("/products", requireAdmin("ADMIN"), async (req, res) => {
  const d = parse(productSchema, req.body);
  const slug = slugify(d.slug || `${d.brand} ${d.name}`);
  if (await prisma.product.findUnique({ where: { slug } })) throw conflict("A product with this URL slug already exists — change the slug.");
  const p = await prisma.product.create({
    data: {
      ...d,
      slug,
      specs: d.specs,
      ...denorm(d.variants),
      variants: { create: d.variants.map(({ id: _id, ...v }, i) => ({ ...v, sortOrder: i })) },
      images: { create: d.images.map((img, i) => ({ url: img.url, key: img.key ?? null, alt: img.alt, sortOrder: i })) },
    },
    include,
  });
  await prisma.$transaction(async (tx) => {
    for (const v of p.variants) await logMovement(tx, v.id, v.stock, "EDIT", { note: "Opening stock", actor: req.admin!.email });
  });
  res.status(201).json(adminProduct(p));
});

adminCatalog.put("/products/:id", requireAdmin("ADMIN"), async (req, res) => {
  const d = parse(productSchema, req.body);
  const existing = await prisma.product.findUnique({ where: { id: String(req.params.id) }, include: { variants: true, images: true } });
  if (!existing) throw notFound("Product not found");
  const slug = slugify(d.slug || existing.slug);
  if (slug !== existing.slug && (await prisma.product.findUnique({ where: { slug } }))) throw conflict("Another product already uses this slug");

  const keepVariantIds = new Set(d.variants.map((v) => v.id).filter(Boolean));
  const removedImages = existing.images.filter((img) => !d.images.some((n) => n.url === img.url));

  const p = await prisma.$transaction(async (tx) => {
    await tx.variant.deleteMany({ where: { productId: existing.id, id: { notIn: [...keepVariantIds] as string[] } } });
    for (const [i, { id, ...v }] of d.variants.entries()) {
      const prev = id ? existing.variants.find((x) => x.id === id) : undefined;
      if (prev) {
        await tx.variant.update({ where: { id: prev.id }, data: { ...v, sortOrder: i } });
        await logMovement(tx, prev.id, v.stock - prev.stock, "EDIT", { note: "Edited in product form", actor: req.admin!.email });
      } else {
        const nv = await tx.variant.create({ data: { ...v, sortOrder: i, productId: existing.id } });
        await logMovement(tx, nv.id, nv.stock, "EDIT", { note: "Opening stock", actor: req.admin!.email });
      }
    }
    await tx.productImage.deleteMany({ where: { productId: existing.id } });
    await tx.productImage.createMany({
      data: d.images.map((img, i) => ({ productId: existing.id, url: img.url, key: img.key ?? null, alt: img.alt, sortOrder: i })),
    });
    const { variants: _v, images: _i, ...fields } = d;
    return tx.product.update({ where: { id: existing.id }, data: { ...fields, slug, specs: d.specs, ...denorm(d.variants) }, include });
  });
  await Promise.all(removedImages.map((img) => deleteImage(img.key)));
  res.json(adminProduct(p));
});

adminCatalog.delete("/products/:id", requireAdmin("ADMIN"), async (req, res) => {
  const p = await prisma.product.findUnique({ where: { id: String(req.params.id) }, include: { images: true } });
  if (!p) throw notFound("Product not found");
  await prisma.product.delete({ where: { id: p.id } });
  await Promise.all(p.images.map((img) => deleteImage(img.key)));
  res.status(204).end();
});

adminCatalog.patch("/variants/:id/stock", async (req, res) => {
  const { stock } = parse(z.object({ stock: z.number().int().min(0).max(1_000_000) }), req.body);
  const id = String(req.params.id);
  await prisma.$transaction((tx) => changeStock(tx, id, { set: stock }, "ADJUST", { actor: req.admin!.email }));
  res.json(variantOut(await prisma.variant.findUniqueOrThrow({ where: { id } })));
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
adminCatalog.post("/uploads", requireAdmin("ADMIN"), upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) throw badRequest("No file uploaded");
  if (!isAllowedImage(file.mimetype)) throw badRequest("Only JPG, PNG, WebP or AVIF images are allowed");
  res.status(201).json(await storeImage(file));
});

// ---------- Categories ----------

const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(80).optional(),
  pet,
  group: z.string().trim().min(1).max(40),
  blurb: z.string().trim().max(300).default(""),
  imageUrl: z.string().url().max(500).optional().nullable().or(z.literal("")).transform((v) => v || null),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

adminCatalog.get("/categories", async (_req, res) => {
  const items = await prisma.category.findMany({ orderBy: [{ pet: "asc" }, { sortOrder: "asc" }], include: { _count: { select: { products: true } } } });
  res.json({ items: items.map(categoryOut) });
});

adminCatalog.post("/categories", requireAdmin("ADMIN"), async (req, res) => {
  const d = parse(categorySchema, req.body);
  const c = await prisma.category.create({ data: { ...d, slug: slugify(d.slug || d.name) } });
  res.status(201).json(categoryOut(c));
});

adminCatalog.put("/categories/:id", requireAdmin("ADMIN"), async (req, res) => {
  const d = parse(categorySchema, req.body);
  const c = await prisma.category.update({ where: { id: String(req.params.id) }, data: { ...d, slug: slugify(d.slug || d.name) } });
  res.json(categoryOut(c));
});

adminCatalog.delete("/categories/:id", requireAdmin("ADMIN"), async (req, res) => {
  const count = await prisma.product.count({ where: { categoryId: String(req.params.id) } });
  if (count) throw badRequest(`Move or delete the ${count} product(s) in this category first`);
  await prisma.category.delete({ where: { id: String(req.params.id) } });
  res.status(204).end();
});

// ---------- Breeds ----------

const breedSchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().max(60).optional(),
  pet,
  tint: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#f3ece1"),
  note: z.string().trim().max(160).default(""),
  imageUrl: z.string().url().max(500).optional().nullable().or(z.literal("")).transform((v) => v || null),
  sortOrder: z.number().int().default(0),
});

adminCatalog.get("/breeds", async (_req, res) => {
  const items = await prisma.breed.findMany({ orderBy: [{ pet: "asc" }, { sortOrder: "asc" }] });
  res.json({ items: items.map((b) => ({ id: b.id, sortOrder: b.sortOrder, ...breedOut(b) })) });
});

adminCatalog.post("/breeds", requireAdmin("ADMIN"), async (req, res) => {
  const d = parse(breedSchema, req.body);
  const b = await prisma.breed.create({ data: { ...d, slug: slugify(d.slug || d.name) } });
  res.status(201).json({ id: b.id, ...breedOut(b) });
});

adminCatalog.put("/breeds/:id", requireAdmin("ADMIN"), async (req, res) => {
  const d = parse(breedSchema, req.body);
  const b = await prisma.breed.update({ where: { id: String(req.params.id) }, data: { ...d, slug: slugify(d.slug || d.name) } });
  res.json({ id: b.id, ...breedOut(b) });
});

adminCatalog.delete("/breeds/:id", requireAdmin("ADMIN"), async (req, res) => {
  await prisma.breed.delete({ where: { id: String(req.params.id) } });
  res.status(204).end();
});
