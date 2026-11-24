import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductListing, { type Chip } from "@/components/ProductListing";
import { Breadcrumbs } from "@/components/ui";
import { categoryTitle, petById } from "@/data/pets";
import { serverGet, serverGetSafe } from "@/lib/api";
import type { Category, ProductList } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await serverGetSafe<Category | null>(`/categories/${(await params).slug}`, null, 300);
  return c ? { title: categoryTitle(c), description: c.blurb, alternates: { canonical: `/collections/${c.slug}` } } : {};
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await serverGet<Category>(`/categories/${slug}`, 300);
  if (!c) notFound();
  const pet = petById(c.pet);
  const [initial, all] = await Promise.all([
    serverGet<ProductList>(`/products?category=${slug}&limit=24`),
    serverGetSafe<{ items: Category[] }>(`/categories?pet=${c.pet}`, { items: [] }, 300),
  ]);
  const siblings = all.items.filter((x) => x.slug !== slug);
  const ls = initial?.facets?.lifeStage ?? [];
  const chips: Chip[] = [
    ...["Puppy", "Kitten", "Adult", "Senior"].filter((s) => ls.some((x) => x.value === s)).map((s) => ({ label: s, params: { lifeStage: s } })),
    ...((initial?.facets?.diet ?? []).some((d) => d.value === "Veg") ? [{ label: "Veg", params: { diet: "Veg" } }] : []),
  ];

  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: pet.name, href: `/pets/${pet.slug}` }, { label: c.name }]} />
      <header className="relative mb-8 flex min-h-[220px] flex-col justify-end gap-5 overflow-hidden rounded-3xl bg-brand-deep p-6 text-white md:min-h-[260px] md:flex-row md:items-end md:justify-between md:p-10">
        {c.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className={`absolute inset-0 ${c.imageUrl ? "bg-gradient-to-r from-brand-deep/95 via-brand/65 to-brand/10" : "bg-brand"}`} />
        <div className="relative">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-sun" aria-hidden /> {pet.name}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight md:text-5xl">{categoryTitle(c)}</h1>
          {c.blurb && <p className="mt-2 max-w-xl text-white/85">{c.blurb}</p>}
        </div>
        <div className="no-scrollbar relative -mx-6 flex gap-2 overflow-x-auto px-6 md:mx-0 md:max-w-md md:flex-wrap md:justify-end md:px-0">
          {siblings.slice(0, 6).map((s) => (
            <Link key={s.slug} href={`/collections/${s.slug}`} className="shrink-0 rounded-full bg-white/15 px-3.5 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white hover:text-brand">
              {s.name}
            </Link>
          ))}
        </div>
      </header>
      <ProductListing key={slug} base={{ category: slug }} initial={initial ?? { items: [], total: 0, page: 1, limit: 24 }} chips={chips} />
    </div>
  );
}
