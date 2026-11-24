import Link from "next/link";
import type { Metadata } from "next";
import ProductArt from "@/components/ProductArt";
import { Breadcrumbs } from "@/components/ui";
import { PETS } from "@/data/pets";
import { serverGetSafe } from "@/lib/api";
import type { Category } from "@/lib/types";

export const metadata: Metadata = { title: "All Categories" };

const KIND: Record<string, "bag" | "treat" | "toy" | "bottle" | "collar" | "litter" | "tee"> = {
  Food: "bag",
  Treats: "treat",
  Play: "toy",
  Care: "bottle",
  Accessories: "collar",
  Litter: "litter",
  Home: "bottle",
  Gifts: "tee",
};

export default async function CategoriesPage() {
  const { items } = await serverGetSafe<{ items: Category[] }>("/categories", { items: [] }, 300);
  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "All categories" }]} />
      <h1 className="font-display text-3xl font-semibold text-brand md:text-4xl">All categories</h1>
      <div className="mt-6 space-y-10">
        {PETS.map((pet) => {
          const cats = items.filter((c) => c.pet === pet.id);
          if (!cats.length) return null;
          return (
            <section key={pet.id}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand">
                  <span>{pet.emoji}</span> {pet.name}
                </h2>
                <Link href={`/pets/${pet.slug}`} className="text-sm font-semibold text-accent hover:text-brand">Shop all →</Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {cats.map((c) => (
                  <Link key={c.slug} href={`/collections/${c.slug}`} className="group flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft transition hover:shadow-lift">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <ProductArt kind={KIND[c.group] ?? "bag"} tint={pet.tint} brand={c.name} className="h-16 w-16 shrink-0 rounded-xl" />
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink group-hover:text-brand">{c.name}</span>
                      <span className="text-xs text-muted">{c.productCount ?? 0} products</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
