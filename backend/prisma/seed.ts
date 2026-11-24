/**
 * Seeds categories, breeds, the sample catalog, starter coupons and the first super admin.
 * Safe to re-run: existing records (matched by slug/code/email) are left untouched.
 *
 *   npm run db:seed
 */
import { PrismaClient, type Pet } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyDummyImages } from "./dummy-images.js";

const prisma = new PrismaClient();
const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(resolve(here, "seed-data.json"), "utf8")) as {
  categories: { slug: string; name: string; pet: string; group: string; blurb: string; sortOrder: number }[];
  breeds: { slug: string; name: string; pet: string; tint: string; note: string; sortOrder: number }[];
  products: {
    slug: string; name: string; brand: string; pet: string; category: string; kind: string; tint: string; badge: string | null;
    tags: string[]; lifeStage: string | null; breedSize: string | null; diet: string | null; flavour: string | null;
    description: string; highlights: string[]; specs: [string, string][];
    variants: { label: string; price: number; mrp: number; grams: number | null }[];
  }[];
};

const PET: Record<string, Pet> = { dog: "DOG", cat: "CAT", small: "SMALL", parent: "PARENT" };
const withSample = process.env.SEED_SAMPLE_CATALOG !== "false";

async function main() {
  // Categories & breeds are structural — always ensure they exist.
  for (const c of data.categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, pet: PET[c.pet], group: c.group, blurb: c.blurb, sortOrder: c.sortOrder },
      update: {},
    });
  }
  for (const b of data.breeds) {
    await prisma.breed.upsert({
      where: { slug: b.slug },
      create: { slug: b.slug, name: b.name, pet: PET[b.pet], tint: b.tint, note: b.note, sortOrder: b.sortOrder },
      update: {},
    });
  }
  console.log(`✔ ${data.categories.length} categories, ${data.breeds.length} breeds`);

  if (withSample) {
    let created = 0;
    for (const p of data.products) {
      if (await prisma.product.findUnique({ where: { slug: p.slug } })) continue;
      const category = await prisma.category.findUniqueOrThrow({ where: { slug: p.category } });
      const minPrice = Math.min(...p.variants.map((v) => v.price));
      const maxDiscount = Math.max(0, ...p.variants.map((v) => (v.mrp > v.price ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0)));
      await prisma.product.create({
        data: {
          slug: p.slug,
          name: p.name,
          brand: p.brand,
          pet: PET[p.pet],
          categoryId: category.id,
          status: "ACTIVE",
          description: p.description,
          highlights: p.highlights,
          specs: p.specs,
          badge: p.badge,
          tags: p.tags,
          lifeStage: p.lifeStage,
          breedSize: p.breedSize,
          diet: p.diet,
          flavour: p.flavour,
          artKind: p.kind,
          tint: p.tint,
          minPrice,
          maxDiscount,
          variants: {
            create: p.variants.map((v, i) => ({
              label: v.label,
              price: v.price,
              mrp: v.mrp,
              grams: v.grams,
              stock: 50,
              sortOrder: i,
              sku: `${p.slug.slice(0, 40)}-${v.label}`.toUpperCase().replace(/[^A-Z0-9]+/g, "-"),
            })),
          },
        },
      });
      created++;
    }
    console.log(`✔ ${created} sample products created (${data.products.length - created} already existed)`);
    const img = await applyDummyImages(prisma);
    console.log(`✔ dummy photos: ${img.products} products, ${img.categories} categories, ${img.breeds} breeds`);
  }

  const coupons = [
    { code: "TAILS15", description: "15% off your first order (up to ₹300)", type: "PERCENT" as const, value: 15, maxDiscount: 30000, firstOrderOnly: true },
    { code: "WOOF100", description: "Flat ₹100 off on orders above ₹999", type: "FLAT" as const, value: 10000, minOrder: 99900 },
  ];
  for (const c of coupons) await prisma.coupon.upsert({ where: { code: c.code }, create: c, update: {} });
  console.log("✔ starter coupons");

  const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (email && password) {
    const exists = await prisma.adminUser.findUnique({ where: { email } });
    if (!exists) {
      await prisma.adminUser.create({ data: { email, name: "Store Owner", role: "SUPER_ADMIN", passwordHash: await bcrypt.hash(password, 12) } });
      console.log(`✔ super admin created: ${email}`);
    } else console.log(`• admin ${email} already exists`);
  } else {
    console.log("• SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipped admin user");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
