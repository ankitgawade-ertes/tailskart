import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarCheck, MessageCircle, PawPrint, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import type { Category } from "@/lib/types";
import { CARE_PHOTOS, unsplash } from "@/data/images";

/* ---------------------------------------------------------------------------
 * 1. Promo tiles — four tall colour blocks with a headline, a button and a photo.
 * ------------------------------------------------------------------------- */

const TILES: { slug: string; eyebrow: string; title: string; bg: string; text: string; button: string }[] = [
  { slug: "dog-wet-food", eyebrow: "Complete meals", title: "Food they’ll finish every time", bg: "bg-brand", text: "text-white", button: "bg-white text-brand" },
  { slug: "dog-treats", eyebrow: "Treat time", title: "Rewards for good boys & girls", bg: "bg-sun", text: "text-ink", button: "bg-brand text-white" },
  { slug: "dog-bowls", eyebrow: "Mealtime, sorted", title: "Bowls & feeders for every size", bg: "bg-fold", text: "text-ink", button: "bg-white text-brand" },
  { slug: "cat-litter", eyebrow: "For the cat crew", title: "Litter delivered before you run out", bg: "bg-brand-deep", text: "text-white", button: "bg-white text-brand" },
];

export function PromoTiles({ categories }: { categories: Category[] }) {
  const tiles = TILES.map((t) => ({ ...t, cat: categories.find((c) => c.slug === t.slug) })).filter((t) => t.cat);
  if (tiles.length < 2) return null;
  return (
    <section className="container-x">
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0">
        {tiles.map((t) => (
          <Link
            key={t.slug}
            href={`/collections/${t.slug}`}
            className={`group relative flex min-h-[400px] w-[72%] shrink-0 snap-start flex-col overflow-hidden rounded-3xl p-5 sm:w-[45%] md:w-auto ${t.bg} ${t.text}`}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-80">{t.eyebrow}</p>
            <h3 className="mt-2 max-w-[16rem] font-display text-2xl font-bold leading-tight">{t.title}</h3>
            <span className={`mt-4 inline-flex w-fit items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition group-hover:gap-2.5 ${t.button}`}>
              Shop now <ArrowRight className="h-3.5 w-3.5" />
            </span>
            <span className="mt-auto block aspect-[4/3] w-full overflow-hidden rounded-2xl pt-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.cat!.imageUrl ?? ""} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * 2. Why choose Tailskart — pet photo in a dashed ring, three reasons each side.
 * ------------------------------------------------------------------------- */

const REASONS = [
  { Icon: BadgeCheck, title: "100% genuine", text: "Sourced from brands and authorised distributors only." },
  { Icon: CalendarCheck, title: "Checked for expiry", text: "Every food pack is checked before it leaves us." },
  { Icon: Truck, title: "Fast delivery", text: "Same-day delivery in select cities, 1–3 days elsewhere." },
  { Icon: RotateCcw, title: "7-day easy returns", text: "Wrong size or not a fan? Send it back within 7 days." },
  { Icon: ShieldCheck, title: "Secure payments", text: "UPI, cards, net banking — or pay cash on delivery." },
  { Icon: MessageCircle, title: "Help on WhatsApp", text: "Our team is a message away, 24×7." },
];

const CENTRE_PHOTO = unsplash("1543466835-00a7907e9de1", 800, 800);

function Reason({ r, align }: { r: (typeof REASONS)[number]; align: "left" | "right" }) {
  return (
    <div className={`flex items-start gap-4 ${align === "left" ? "lg:flex-row-reverse lg:text-right" : ""}`}>
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-brand shadow-soft ring-1 ring-line">
        <r.Icon className="h-6 w-6" />
      </span>
      <span>
        <span className="block font-display text-lg font-bold text-ink">{r.title}</span>
        <span className="mt-1 block text-sm leading-relaxed text-muted">{r.text}</span>
      </span>
    </div>
  );
}

export function WhyChoose({ freeShippingAbove }: { freeShippingAbove: number }) {
  return (
    <section className="paw-pattern relative overflow-hidden bg-brand-soft py-14 md:py-20">
      <div className="container-x">
        <div className="mx-auto mb-10 max-w-2xl text-center md:mb-14">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white text-brand shadow-soft">
            <PawPrint className="h-5 w-5" />
          </span>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-accent">Why choose us</p>
          <h2 className="mt-2 font-display text-[1.9rem] font-bold leading-tight text-ink md:text-[2.6rem]">A shop that remembers the pack</h2>
          <p className="mt-3 text-muted">The good stuff, delivered fast, from a team that actually picks up the phone. Free delivery above ₹{freeShippingAbove}.</p>
        </div>

        <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr] lg:gap-12">
          <div className="order-2 space-y-8 lg:order-1">
            {REASONS.slice(0, 3).map((r) => (
              <Reason key={r.title} r={r} align="left" />
            ))}
          </div>

          <div className="order-1 mx-auto lg:order-2">
            <div className="relative grid h-[280px] w-[280px] place-items-center rounded-full border-2 border-dashed border-brand/30 md:h-[380px] md:w-[380px]">
              <div className="h-[240px] w-[240px] overflow-hidden rounded-full bg-fold shadow-lift ring-8 ring-white md:h-[330px] md:w-[330px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={CENTRE_PHOTO} alt="A happy dog" loading="lazy" className="h-full w-full object-cover" />
              </div>
              {/* small paw badges on the ring */}
              {["left-2 top-10", "right-2 top-10", "left-6 bottom-6", "right-6 bottom-6"].map((pos, i) => (
                <span key={pos} className={`absolute grid h-10 w-10 place-items-center rounded-full shadow-soft ${pos} ${i % 2 ? "bg-sun text-ink" : "bg-brand text-white"}`}>
                  <PawPrint className="h-4 w-4" />
                </span>
              ))}
            </div>
          </div>

          <div className="order-3 space-y-8">
            {REASONS.slice(3).map((r) => (
              <Reason key={r.title} r={r} align="right" />
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link href="/about" className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white shadow-lift transition hover:bg-brand-deep">
            Read our story <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * 3. Care cards — solid partner colour on the left, photo on the right.
 * ------------------------------------------------------------------------- */

const CARE = [
  {
    href: "/ametad",
    name: "ametad",
    title: "Veterinary hospital",
    text: "Expert vets and modern care — consultations, diagnostics and specialist treatment for a healthier, happier pet.",
    cta: "Book a visit",
    photo: CARE_PHOTOS.ametad,
    bg: "bg-ametad",
    from: "from-ametad",
    button: "text-ametad",
  },
  {
    href: "/pharko",
    name: "pharko",
    title: "Veterinary pharmacy",
    text: "Prescription medicines and refills, checked by a pharmacist and ready to collect at the pharko counter.",
    cta: "Upload prescription",
    photo: CARE_PHOTOS.pharko,
    bg: "bg-pharko",
    from: "from-pharko",
    button: "text-pharko",
  },
];

export function CareCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-6">
      {CARE.map((c) => (
        <Link key={c.href} href={c.href} className={`group relative flex min-h-[260px] overflow-hidden rounded-3xl text-white md:min-h-[300px] ${c.bg}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* Photo zooms inside its own clipped frame, so its edge never shows past the colour fade. */}
          <span className="absolute inset-y-0 right-0 w-[58%] overflow-hidden">
            <img src={c.photo} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            <span className={`absolute inset-y-0 -left-px w-2/3 bg-gradient-to-r ${c.from} via-transparent to-transparent`} />
          </span>
          <div className="relative z-10 flex w-[62%] flex-col justify-center p-6 md:p-8">
            <p className="font-display text-5xl font-bold lowercase leading-none tracking-[-0.03em] md:text-6xl">{c.name}</p>
            <p className="mt-3 text-lg font-bold md:text-xl">{c.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-white/85 md:text-base">{c.text}</p>
            <span className={`mt-5 inline-flex w-fit items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold shadow-soft transition group-hover:gap-3 ${c.button}`}>
              {c.cta} <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
