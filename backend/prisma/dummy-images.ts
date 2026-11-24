/**
 * Attaches the dummy photos in seed-images.json to products, categories and breeds
 * that don't have an image yet. Never overwrites photos uploaded through the admin panel.
 *
 *   npm run db:dummy-images
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const images = JSON.parse(readFileSync(resolve(here, "seed-images.json"), "utf8")) as {
  products: Record<string, string[]>;
  categories: Record<string, string>;
  breeds: Record<string, string>;
};

export async function applyDummyImages(prisma: PrismaClient) {
  let products = 0;
  for (const [slug, urls] of Object.entries(images.products)) {
    const p = await prisma.product.findUnique({ where: { slug }, include: { _count: { select: { images: true } } } });
    if (!p || p._count.images > 0) continue;
    await prisma.productImage.createMany({
      data: urls.map((url, i) => ({ productId: p.id, url, key: null, alt: `${p.brand} ${p.name}`, sortOrder: i })),
    });
    products++;
  }
  let categories = 0;
  for (const [slug, url] of Object.entries(images.categories)) {
    const r = await prisma.category.updateMany({ where: { slug, imageUrl: null }, data: { imageUrl: url } });
    categories += r.count;
  }
  let breeds = 0;
  for (const [slug, url] of Object.entries(images.breeds)) {
    const r = await prisma.breed.updateMany({ where: { slug, imageUrl: null }, data: { imageUrl: url } });
    breeds += r.count;
  }
  return { products, categories, breeds };
}

// Run directly
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const prisma = new PrismaClient();
  applyDummyImages(prisma)
    .then((r) => console.log(`✔ dummy images: ${r.products} products, ${r.categories} categories, ${r.breeds} breeds`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
