import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductListing from "@/components/ProductListing";
import { Breadcrumbs, PageHero } from "@/components/ui";
import { serverGet, serverGetSafe } from "@/lib/api";
import type { Breed, ProductList } from "@/lib/types";

async function findBreed(slug: string) {
  const { items } = await serverGetSafe<{ items: Breed[] }>("/breeds", { items: [] }, 300);
  return items.find((b) => b.slug === slug);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const b = await findBreed((await params).slug);
  return b ? { title: `${b.name} Food & Supplies` } : {};
}

export default async function BreedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await findBreed(slug);
  if (!b) notFound();
  const initial = await serverGet<ProductList>(`/products?breed=${slug}&limit=24`);
  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Shop by Breed", href: "/breeds" }, { label: b.name }]} />
      <PageHero title={`For your ${b.name}`} subtitle={`${b.note} Here's what ${b.name} parents buy most.`} tint={b.tint} emoji={b.pet === "dog" ? "🐕" : "🐈"} image={b.imageUrl} />
      <div className="mt-8">
        <ProductListing key={slug} base={{ breed: slug }} initial={initial ?? { items: [], total: 0, page: 1, limit: 24 }} />
      </div>
    </div>
  );
}
