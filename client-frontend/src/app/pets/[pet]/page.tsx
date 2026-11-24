import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductListing from "@/components/ProductListing";
import ProductArt from "@/components/ProductArt";
import { Breadcrumbs, SectionHeading } from "@/components/ui";
import { petBySlug } from "@/data/pets";
import { serverGet, serverGetSafe } from "@/lib/api";
import type { Breed, Category, ProductList } from "@/lib/types";
import { PET_PHOTOS } from "@/data/images";

export async function generateMetadata({ params }: { params: Promise<{ pet: string }> }): Promise<Metadata> {
  const p = petBySlug((await params).pet);
  return p ? { title: `${p.name} — Food, Treats & Supplies`, description: p.tagline, alternates: { canonical: `/pets/${p.slug}` } } : {};
}

const KIND_BY_GROUP: Record<string, "bag" | "treat" | "toy" | "bottle" | "collar" | "litter" | "tee"> = {
  Food: "bag",
  Treats: "treat",
  Play: "toy",
  Care: "bottle",
  Accessories: "collar",
  Litter: "litter",
  Home: "bottle",
  Gifts: "tee",
};

export default async function PetPage({ params }: { params: Promise<{ pet: string }> }) {
  const pet = petBySlug((await params).pet);
  if (!pet) notFound();
  const [cats, breeds, initial] = await Promise.all([
    serverGetSafe<{ items: Category[] }>(`/categories?pet=${pet.id}`, { items: [] }, 300),
    serverGetSafe<{ items: Breed[] }>("/breeds", { items: [] }, 300),
    serverGet<ProductList>(`/products?pet=${pet.id}&limit=24`),
  ]);
  const petBreeds = breeds.items.filter((b) => b.pet === pet.id);

  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: pet.name }]} />
      <section className="relative flex min-h-[280px] items-end overflow-hidden rounded-3xl bg-brand-deep px-6 py-10 md:min-h-[340px] md:items-center md:px-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PET_PHOTOS[pet.id]} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_35%]" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-deep/95 via-brand/60 to-transparent" />
        <div className="relative z-10 max-w-xl text-white">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-sun" aria-hidden /> Shop for {pet.name.toLowerCase()}
          </p>
          <h1 className="mt-3 font-display text-5xl font-bold leading-none md:text-7xl">{pet.name}</h1>
          <p className="mt-3 text-lg text-white/85">{pet.tagline}</p>
        </div>
      </section>

      {cats.items.length > 0 && (
        <section className="mt-12">
          <SectionHeading eyebrow="Browse" title="Shop by category" />
          <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {cats.items.map((c) => (
              <Link key={c.slug} href={`/collections/${c.slug}`} className="group flex flex-col items-center text-center">
                <span className="block aspect-square w-full overflow-hidden rounded-2xl bg-white transition group-hover:-translate-y-1 group-hover:shadow-lift md:rounded-3xl">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <ProductArt kind={KIND_BY_GROUP[c.group] ?? "bag"} tint={pet.tint} brand={c.name} className="h-full w-full transition group-hover:scale-105" />
                  )}
                </span>
                <span className="mt-2.5 block text-xs font-bold leading-tight text-ink md:text-sm">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {petBreeds.length > 0 && (
        <section className="mt-12">
          <SectionHeading eyebrow="Made for them" title="Shop by breed" />
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            {petBreeds.map((b) => (
              <Link key={b.slug} href={`/breeds/${b.slug}`} className="flex shrink-0 items-center gap-3 rounded-2xl bg-white py-2 pl-2 pr-5 hover:shadow-lift">
                <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl text-xl" style={{ background: b.tint }}>
                  {b.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    pet.emoji
                  )}
                </span>
                <span className="text-sm font-semibold">{b.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
        <SectionHeading eyebrow="Everything" title={`All ${pet.name.toLowerCase()} products`} />
        <ProductListing
          key={pet.id}
          base={{ pet: pet.id }}
          initial={initial ?? { items: [], total: 0, page: 1, limit: 24 }}
          chips={cats.items.map((c) => ({ label: c.name, params: { category: c.slug } }))}
        />
      </section>
    </div>
  );
}
