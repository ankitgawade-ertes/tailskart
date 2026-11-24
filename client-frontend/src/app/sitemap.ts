import type { MetadataRoute } from "next";
import { serverGetSafe } from "@/lib/api";
import { PETS } from "@/data/pets";
import { POSTS } from "@/data/content";
import type { Breed, Category, ProductList } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const [cats, breeds] = await Promise.all([
    serverGetSafe<{ items: Category[] }>("/categories", { items: [] }, 3600),
    serverGetSafe<{ items: Breed[] }>("/breeds", { items: [] }, 3600),
  ]);
  const products: string[] = [];
  for (let page = 1; page <= 50; page++) {
    const r = await serverGetSafe<ProductList>(`/products?limit=60&page=${page}&facets=false&sort=new`, { items: [], total: 0, page, limit: 60 }, 3600);
    products.push(...r.items.map((p) => p.slug));
    if (r.items.length < 60) break;
  }
  const url = (path: string, priority = 0.6) => ({ url: `${site}${path}`, lastModified: new Date(), priority });
  return [
    url("/", 1),
    url("/offers", 0.8),
    url("/breeds", 0.6),
    url("/blog", 0.5),
    url("/about", 0.3),
    url("/contact", 0.3),
    url("/faq", 0.3),
    ...PETS.map((p) => url(`/pets/${p.slug}`, 0.9)),
    ...cats.items.map((c) => url(`/collections/${c.slug}`, 0.8)),
    ...breeds.items.map((b) => url(`/breeds/${b.slug}`, 0.5)),
    ...products.map((s) => url(`/products/${s}`, 0.7)),
    ...POSTS.map((p) => url(`/blog/${p.slug}`, 0.4)),
  ];
}
