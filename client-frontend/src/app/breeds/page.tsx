import Link from "next/link";
import type { Metadata } from "next";
import { Breadcrumbs, PageHero } from "@/components/ui";
import { serverGetSafe } from "@/lib/api";
import { PET_PHOTOS } from "@/data/images";
import type { Breed } from "@/lib/types";

export const metadata: Metadata = { title: "Shop by Breed" };

export default async function BreedsPage() {
  const { items } = await serverGetSafe<{ items: Breed[] }>("/breeds", { items: [] }, 300);
  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Shop by Breed" }]} />
      <PageHero title="Shop by breed" subtitle="Food, grooming and gear picked for your pet's size, coat and energy." tint="#e3e9fc" emoji="🐾" image={PET_PHOTOS.dog} />
      {(["dog", "cat"] as const).map((pet) => {
        const list = items.filter((b) => b.pet === pet);
        if (!list.length) return null;
        return (
          <section key={pet} className="mt-10">
            <h2 className="mb-4 font-display text-2xl font-semibold text-brand">{pet === "dog" ? "Dog breeds" : "Cat breeds"}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {list.map((b) => (
                <Link key={b.slug} href={`/breeds/${b.slug}`} className="group rounded-3xl bg-white p-4 text-center shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
                  <span className="mx-auto grid aspect-square w-full place-items-center overflow-hidden rounded-3xl text-6xl transition group-hover:scale-105" style={{ background: b.tint }}>
                    {b.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : pet === "dog" ? (
                      "🐕"
                    ) : (
                      "🐈"
                    )}
                  </span>
                  <p className="mt-3 font-display text-lg font-semibold text-brand">{b.name}</p>
                  <p className="text-xs text-muted">{b.note}</p>
                  <p className="mt-2 text-xs font-bold text-accent">{b.productCount ?? 0} products →</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
