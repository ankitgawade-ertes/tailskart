import Link from "next/link";
import { ArrowRight, Truck, BadgeCheck, RotateCcw, Banknote, Quote, ChevronDown, MessageCircle } from "lucide-react";
import { CareCards, PromoTiles, WhyChoose } from "@/components/HomeSections";
import { HeroSlider, CouponChips, DealTabs, type PublicCoupon } from "@/components/HomeBits";
import ProductCard from "@/components/ProductCard";
import ProductArt from "@/components/ProductArt";
import { BLOG_PHOTOS, PAGE_PHOTOS, PET_PHOTOS } from "@/data/images";
import { serverGetSafe } from "@/lib/api";
import type { Category, ProductList } from "@/lib/types";
import Rail from "@/components/Rail";
import { SectionHeading, Stars, btn } from "@/components/ui";
import { PETS, PRICE_TILES, categoryTitle } from "@/data/pets";
import { FAQS, POSTS, TESTIMONIALS } from "@/data/content";
import { getSite } from "@/lib/site";

/*
 * Homepage — one continuous flow:
 *   hero → browse (pets, categories) → products (bestsellers) → offers (promo tiles, deals + codes)
 *   → care (ametad, pharko + medicines) → budget (price) → new arrivals → why us → guides → help.
 * Shape language: every image and card is a rounded rectangle (24px large / 16px small);
 * only buttons and filter chips are pills. Headings are all left-aligned with the link on the right.
 */

const FEATURED_CATS = ["dog-dry-food", "cat-litter", "dog-treats", "cat-wet-food", "dog-toys", "dog-grooming", "dog-clothing", "cat-toys"];
const EMPTY: ProductList = { items: [], total: 0, page: 1, limit: 12 };
const ART: Record<string, { kind: "bag" | "litter" | "treat" | "pouch" | "toy" | "bottle" | "tee"; tint: string }> = {
  "dog-dry-food": { kind: "bag", tint: "#f8d9c4" },
  "cat-litter": { kind: "litter", tint: "#e3dcf3" },
  "dog-treats": { kind: "treat", tint: "#f3c9a8" },
  "cat-wet-food": { kind: "pouch", tint: "#cde6f5" },
  "dog-toys": { kind: "toy", tint: "#f8c9c4" },
  "dog-grooming": { kind: "bottle", tint: "#e7e0f5" },
  "dog-clothing": { kind: "tee", tint: "#f1cfc2" },
  "cat-toys": { kind: "toy", tint: "#fbe1c5" },
};

// Brand colours only (ultramarine, deep, fold blue, sun with ink text).
const PRICE_STYLE = ["bg-brand text-white", "bg-brand-deep text-white", "bg-fold text-ink", "bg-sun text-ink"];

export default async function Home() {
  const [best, deals, fresh, cats, coupons, meds, site] = await Promise.all([
    serverGetSafe<ProductList>("/products?badge=Bestseller&limit=12&facets=false", EMPTY),
    serverGetSafe<ProductList>("/products?onSale=true&sort=discount&limit=16&facets=false", EMPTY),
    serverGetSafe<ProductList>("/products?sort=new&limit=12&facets=false", EMPTY),
    serverGetSafe<{ items: Category[] }>("/categories", { items: [] }, 300),
    serverGetSafe<{ items: PublicCoupon[] }>("/coupons", { items: [] }, 60),
    serverGetSafe<ProductList>("/products?group=Pharmacy&sort=popular&limit=12&facets=false", EMPTY, 120),
    getSite(),
  ]);
  const featured = FEATURED_CATS.map((slug) => cats.items.find((c) => c.slug === slug)).filter(Boolean) as Category[];
  // Fill up to 8 with other curated (photographed) categories.
  const extra = cats.items.filter((c) => c.imageUrl && c.group !== "Pharmacy" && !featured.includes(c));
  const shownCats = [...featured, ...extra].slice(0, 8);
  const faqs = FAQS.slice(0, 5);

  return (
    <div className="space-y-16 pb-4 md:space-y-24">
      {/* 1 · Hero + trust ribbon */}
      <div>
        <HeroSlider />
        <div className="container-x">
          <div className="relative z-10 mx-3 -mt-8 grid grid-cols-2 gap-x-3 gap-y-4 rounded-3xl bg-white p-4 shadow-lift md:mx-10 md:grid-cols-4 md:p-5">
            {[
              [Truck, "Same-day", "delivery in select cities"],
              [BadgeCheck, "100%", "genuine products"],
              [RotateCcw, "7-day", "easy returns"],
              [Banknote, "COD", "cash on delivery available"],
            ].map(([Icon, a, b]) => {
              const I = Icon as typeof Truck;
              return (
                <div key={a as string} className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft">
                    <I className="h-5 w-5 text-brand" />
                  </span>
                  <span className="leading-tight">
                    <span className="block font-display text-lg font-bold text-ink">{a as string}</span>
                    <span className="text-xs text-muted">{b as string}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2 · Shop by pet */}
      <section className="container-x">
        <SectionHeading eyebrow="Start here" title="Who are you shopping for today?" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {PETS.map((p) => (
            <Link key={p.id} href={`/pets/${p.slug}`} className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl p-4 md:p-6" style={{ background: p.tint }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PET_PHOTOS[p.id]} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
              <span className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
              <span className="relative flex items-end justify-between gap-3">
                <span>
                  <span className="block font-display text-xl font-bold text-white md:text-3xl">{p.name}</span>
                  <span className="mt-1 hidden text-sm text-white/80 md:block">{p.tagline}</span>
                </span>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-brand transition group-hover:bg-brand group-hover:text-white md:h-12 md:w-12">
                  <ArrowRight className="h-5 w-5" />
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 3 · Shop by category */}
      <section className="container-x">
        <SectionHeading eyebrow="Browse" title="Shop by category" href="/categories" linkText="All categories" />
        <div className="grid grid-cols-4 gap-x-3 gap-y-5 md:grid-cols-8 md:gap-4">
          {shownCats.map((c) => {
            const art = ART[c.slug] ?? { kind: "bag" as const, tint: PETS.find((p) => p.id === c.pet)?.tint ?? "#eceff7" };
            return (
              <Link key={c.slug} href={`/collections/${c.slug}`} className="group flex flex-col gap-2 text-center">
                <span className="block aspect-square w-full overflow-hidden rounded-2xl bg-white transition group-hover:-translate-y-1 group-hover:shadow-lift md:rounded-3xl">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <ProductArt kind={art.kind} tint={art.tint} brand={c.name} className="h-full w-full" />
                  )}
                </span>
                <span className="text-xs font-bold leading-tight text-ink md:text-sm">{categoryTitle(c)}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 4 · Bestsellers */}
      {best.items.length > 0 && (
        <section className="container-x">
          <SectionHeading eyebrow="Most loved" title="Bestsellers this week" href="/search?q=bestseller" />
          <Rail>{best.items.map((p) => <ProductCard key={p.id} product={p} />)}</Rail>
        </section>
      )}

      {/* 5 · Promo tiles */}
      <PromoTiles categories={cats.items} />

      {/* 6 · Deals of the day, with today's codes */}
      {deals.items.length > 0 && (
        <section className="bg-white py-12 md:py-16">
          <div className="container-x">
            <SectionHeading eyebrow="Save more" title="Deals of the day" subtitle="Our biggest discounts right now — plus codes you can use at checkout." href="/offers" linkText="All offers" />
            <CouponChips coupons={coupons.items} />
            <DealTabs products={deals.items} />
          </div>
        </section>
      )}

      {/* 7 · Care: ametad + pharko, and a short medicines row */}
      <section className="container-x">
        <SectionHeading eyebrow="Beyond the basket" title="Care for your pet" subtitle="Vet visits, prescriptions and everyday medicines, right next to your pet’s shop." />
        <CareCards />
        {meds.items.length > 0 && (
          <div className="mt-10">
            <div className="mb-4 flex items-end justify-between gap-4">
              <h3 className="font-display text-xl font-bold text-ink md:text-2xl">From the pharko shop</h3>
              <Link href="/pharko#shop-meds" className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-pharko hover:underline">
                All medicines <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <Rail>{meds.items.map((p) => <ProductCard key={p.id} product={p} />)}</Rail>
          </div>
        )}
      </section>

      {/* 8 · Shop by price */}
      <section className="container-x">
        <SectionHeading eyebrow="Budget friendly" title="Shop by price" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {PRICE_TILES.map((t, i) => (
            <Link
              key={t.value}
              href={`/search?price=${t.value}`}
              className={`group relative flex min-h-[170px] flex-col justify-between gap-3 overflow-hidden rounded-3xl p-5 transition hover:-translate-y-1 hover:shadow-lift md:min-h-[200px] md:p-6 ${PRICE_STYLE[i]}`}
            >
              <span className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">{i === 0 ? "Under" : i === 3 ? "Premium" : "Up to"}</span>
              <span>
                <span className="block font-display text-[2rem] font-bold leading-none sm:text-4xl md:text-5xl">{t.short}</span>
                <span className="mt-2 block text-sm opacity-80">{t.note}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-bold">
                Shop now <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 9 · New arrivals */}
      {fresh.items.length > 0 && (
        <section className="container-x">
          <SectionHeading eyebrow="Just landed" title="New arrivals" href="/search?q=new" />
          <Rail>{fresh.items.map((p) => <ProductCard key={p.id} product={p} />)}</Rail>
        </section>
      )}

      {/* 10 · Why choose Tailskart */}
      <WhyChoose freeShippingAbove={site.freeShippingAbove} />

      {/* Testimonials — add real customer reviews in src/data/content.ts */}
      {TESTIMONIALS.length > 0 && (
        <section className="container-x">
          <SectionHeading eyebrow="Reviews" title="Loved by pet parents" />
          <div className="grid gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((r) => (
              <figure key={r.name} className="flex flex-col rounded-3xl bg-white p-6 shadow-soft">
                <Quote className="h-7 w-7 text-accent" />
                <blockquote className="mt-3 flex-1 text-ink/80">{r.text}</blockquote>
                <Stars rating={r.rating} />
                <figcaption className="mt-3 text-sm">
                  <b>{r.name}</b> <span className="text-muted">· {r.city} · bought {r.product}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* 11 · Pet guides */}
      <section className="container-x">
        <SectionHeading eyebrow="Pet guides" title="Tips from our pet care team" href="/blog" linkText="Read all" />
        <div className="grid gap-5 md:grid-cols-3">
          {POSTS.slice(0, 3).map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="group flex flex-col overflow-hidden rounded-3xl bg-white transition hover:-translate-y-1 hover:shadow-lift">
              <div className="relative aspect-[16/10] overflow-hidden" style={{ background: p.tint }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={BLOG_PHOTOS[p.slug]} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <span className="absolute left-4 top-4 rounded-xl bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand">{p.category}</span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-xs font-semibold text-muted">{p.read}</p>
                <h3 className="mt-1 font-display text-xl font-bold leading-snug text-ink group-hover:text-brand">{p.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-muted">{p.excerpt}</p>
                <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-bold text-brand">
                  Read guide <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 12 · Our story + FAQs */}
      <section className="container-x grid gap-6 lg:grid-cols-2 lg:gap-10">
        <div className="overflow-hidden rounded-3xl bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PAGE_PHOTOS.about} alt="" loading="lazy" className="aspect-[16/8] w-full object-cover" />
          <div className="p-6 md:p-8">
            <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">
              <span className="h-[3px] w-5 rounded-full bg-accent" aria-hidden /> Our story
            </p>
            <h2 className="font-display text-2xl font-bold leading-tight text-ink md:text-3xl">An online pet store that feels like your neighbourhood shop</h2>
            <p className="mt-3 text-muted">
              Tailskart stocks food, treats, toys and essentials for dogs, cats and small pets — from everyday kibble to breed-specific diets. Everything is sourced from
              brands or authorised distributors, every food pack is checked for expiry, and our team is a WhatsApp message away.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/about" className={btn.primary}>Our story</Link>
              <Link href="/faq" className={btn.ghost}>Read FAQs</Link>
            </div>
          </div>
        </div>
        <div>
          <SectionHeading eyebrow="Help" title="Questions, answered" href="/faq" linkText="All FAQs" />
          <div className="space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl bg-white p-5 open:ring-1 open:ring-brand/20">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-bold text-ink">
                  {f.q}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand transition group-open:rotate-180 group-open:bg-brand group-open:text-white">
                    <ChevronDown className="h-4 w-4" />
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
          <a href={site.whatsapp} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-3 rounded-2xl bg-brand-soft p-4 text-sm font-semibold text-brand hover:bg-accent-soft">
            <MessageCircle className="h-5 w-5" /> Still stuck? Chat with us on WhatsApp <ArrowRight className="ml-auto h-4 w-4" />
          </a>
        </div>
      </section>
    </div>
  );
}
