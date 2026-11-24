"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Copy, Pause, Play, Scissors } from "lucide-react";
import { SITE } from "@/data/content";
import { formatINR } from "@/lib/api";
import type { Pet, Product } from "@/lib/types";
import ProductCard from "./ProductCard";
import Rail from "./Rail";

// Hero photos live in public/hero (2000×750, pets on the right, warm empty space on the left for text).
const SLIDES: {
  image: string;
  eyebrow: string;
  title: string;
  text: string;
  cta: string;
  href: string;
  alt: { label: string; href: string };
}[] = [
  {
    image: "/hero/hero-1.webp",
    eyebrow: "Their everyday, delivered",
    title: "Your pet’s usuals, all in one place.",
    text: "The exact food, litter and treats you bought last time — with price per kg upfront and a delivery date before you pay.",
    cta: "Shop the usuals",
    href: "/pets/dogs",
    alt: { label: "Shop for cats", href: "/pets/cats" },
  },
  {
    image: "/hero/hero-2.webp",
    eyebrow: "Nap time, upgraded",
    title: "Cosy beds for the best naps.",
    text: "Plush beds, mats and soft blankets — big enough for one, comfy enough to share.",
    cta: "Shop beds",
    href: "/collections/dog-beds",
    alt: { label: "Cat beds & accessories", href: "/collections/cat-accessories" },
  },
  {
    image: "/hero/hero-3.webp",
    eyebrow: "Playtime picks",
    title: "Toys they’ll actually play with.",
    text: "Plush bones, rope balls and chews for every kind of player — from gentle nibblers to power chewers.",
    cta: "Shop dog toys",
    href: "/collections/dog-toys",
    alt: { label: "Cat toys", href: "/collections/cat-toys" },
  },
  {
    image: "/hero/hero-4.webp",
    eyebrow: "Winter-ready",
    title: "Snug from nose to tail.",
    text: "Sweaters, scarves and warm blankets to keep them cosy through the cold months.",
    cta: "Shop winter wear",
    href: "/collections/dog-clothing",
    alt: { label: "Today’s offers", href: "/offers" },
  },
];

export function HeroSlider() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, [paused]);
  const go = (d: number) => setI((x) => (x + d + SLIDES.length) % SLIDES.length);
  const s = SLIDES[i];

  return (
    <section
      className="relative overflow-hidden bg-[#f6ebdd] lg:aspect-[8/3] lg:w-full"
      // --edge lines the text up with the page's content column (container-x).
      style={{ "--edge": "max(3.5rem, calc((100vw - 1280px) / 2 + 1.5rem))" } as React.CSSProperties}
      aria-roledescription="carousel"
      aria-label="Featured"
    >
      {/* Photo: full width on desktop; on phones it sits on top, cropped to the pets. */}
      <div className="relative aspect-[4/3] sm:aspect-[16/9] md:absolute md:inset-0 md:aspect-auto">
        {SLIDES.map((slide, k) => (
          // Every slide stays mounted so photos are ready when they fade in.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={slide.image}
            src={slide.image}
            alt=""
            aria-hidden
            fetchPriority={k === 0 ? "high" : "low"}
            className={`absolute inset-0 h-full w-full object-cover object-[78%_center] transition-opacity duration-700 md:object-right ${k === i ? "opacity-100" : "opacity-0"}`}
          />
        ))}
        {/* Soft warm wash on the text side only, so the pets stay bright. */}
        <div className="absolute inset-0 hidden bg-gradient-to-r from-[#f6ebdd]/95 via-[#f6ebdd]/55 to-transparent md:block md:via-38% md:to-55%" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#f6ebdd] to-transparent md:hidden" />
      </div>

      <div key={i} className="animate-fade-up relative px-6 pb-24 pt-2 md:flex md:min-h-[480px] md:max-w-[55%] md:flex-col md:justify-center md:px-12 md:pb-24 md:pt-12 lg:absolute lg:inset-y-0 lg:left-0 lg:min-h-0 lg:w-[min(46%,calc(var(--edge)+31rem))] lg:max-w-none lg:pb-28 lg:pl-[var(--edge)] lg:pr-8 lg:pt-6">
        <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-brand shadow-soft backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-sun" aria-hidden /> {s.eyebrow}
        </p>
        <h1 className="mt-4 font-display text-[2.3rem] font-bold leading-[1.03] text-ink md:text-[3rem] lg:text-[2.6rem] xl:text-[3.15rem]">{s.title}</h1>
        <p className="mt-4 max-w-md text-base text-ink/75 md:text-lg lg:text-base xl:text-lg">{s.text}</p>
        <div className="mt-7 flex flex-wrap gap-3 lg:mt-6">
          <Link href={s.href} className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3.5 text-sm font-bold text-white shadow-lift transition hover:bg-brand-deep">
            {s.cta} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href={s.alt.href} className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-white/85 px-6 py-3.5 text-sm font-bold text-brand backdrop-blur transition hover:border-brand hover:bg-white">
            {s.alt.label}
          </Link>
        </div>
      </div>

      <div className="absolute bottom-12 left-6 flex items-center gap-2 md:bottom-14 md:left-12 lg:left-[var(--edge)]">
        {SLIDES.map((_, k) => (
          <button key={k} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} aria-current={k === i} className={`h-2 rounded-full transition-all ${k === i ? "w-9 bg-brand" : "w-2 bg-brand/25 hover:bg-brand/50"}`} />
        ))}
        <button onClick={() => setPaused(!paused)} aria-label={paused ? "Play slideshow" : "Pause slideshow"} className="ml-2 grid h-8 w-8 place-items-center rounded-xl bg-white/85 text-brand shadow-soft hover:bg-white">
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div className="absolute bottom-14 right-6 hidden gap-2 md:right-12 md:flex lg:right-[var(--edge)]">
        <button onClick={() => go(-1)} aria-label="Previous slide" className="grid h-11 w-11 place-items-center rounded-xl bg-white/85 text-brand shadow-soft backdrop-blur hover:bg-white">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button onClick={() => go(1)} aria-label="Next slide" className="grid h-11 w-11 place-items-center rounded-xl bg-white/85 text-brand shadow-soft backdrop-blur hover:bg-white">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}

export interface PublicCoupon {
  code: string;
  description: string;
  type: "PERCENT" | "FLAT" | "BXGY";
  value: number;
  maxDiscount: number | null;
  minOrder: number;
  firstOrderOnly: boolean;
  buyQty?: number | null;
  getQty?: number | null;
  badgeText?: string | null;
}

const couponTitle = (c: PublicCoupon) =>
  c.type === "BXGY" ? `Buy ${c.buyQty}, get ${c.getQty} free` : c.type === "PERCENT" ? `${c.value}% off` : `${formatINR(c.value)} off`;
const couponNote = (c: PublicCoupon) =>
  c.description ||
  [c.minOrder ? `On orders above ${formatINR(c.minOrder)}` : "On any order", c.maxDiscount ? `up to ${formatINR(c.maxDiscount)}` : null, c.firstOrderOnly ? "first order only" : null]
    .filter(Boolean)
    .join(" · ");

function CopyCode({ code, tone }: { code: string; tone: "light" | "dark" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold transition ${tone === "dark" ? "bg-white text-brand hover:bg-fold-soft" : "bg-brand text-white hover:bg-brand-deep"}`}
      aria-label={`Copy code ${code}`}
    >
      <span className="tracking-widest">{code}</span>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** "Coupons for you": the first-order code plus live coupons from Admin → Coupons. */
export function CouponCards({ coupons }: { coupons: PublicCoupon[] }) {
  const others = coupons.filter((c) => c.code !== SITE.firstOrderCode).slice(0, 5);
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0">
      <article className="fold-band relative flex min-w-[85%] snap-start flex-col justify-between overflow-hidden rounded-2xl p-5 text-white md:min-w-0">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-fold">New to Tailskart?</p>
          <p className="mt-1 font-display text-2xl font-bold">15% off your first order</p>
          <p className="mt-1 text-sm text-white/75">Up to ₹300 on your first order.</p>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 pr-8">
          <CopyCode code={SITE.firstOrderCode} tone="dark" />
        </div>
      </article>
      {others.map((c) => (
        <article key={c.code} className="relative flex min-w-[85%] snap-start overflow-hidden rounded-2xl border border-dashed border-brand/30 bg-white md:min-w-0">
          <div className="flex flex-1 flex-col justify-between p-5">
            <div>
              {c.badgeText && <span className="mb-2 inline-block rounded-md bg-sun px-2 py-0.5 text-[11px] font-bold text-ink">{c.badgeText}</span>}
              <p className="font-display text-2xl font-bold text-ink">{couponTitle(c)}</p>
              <p className="mt-1 text-sm text-muted">{couponNote(c)}</p>
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <CopyCode code={c.code} tone="light" />
              <Scissors className="h-4 w-4 -rotate-90 text-brand/30" aria-hidden />
            </div>
          </div>
          {/* ticket notches */}
          <span className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-cream" aria-hidden />
          <span className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-cream" aria-hidden />
        </article>
      ))}
      {others.length === 0 && (
        <Link href="/offers" className="flex min-w-[85%] snap-start flex-col justify-between rounded-2xl border border-dashed border-brand/30 bg-white p-5 md:col-span-2 md:min-w-0">
          <p className="font-display text-2xl font-bold text-ink">Save more with today’s codes</p>
          <p className="mt-1 text-sm text-muted">First-order discounts and cart offers — apply a code at checkout.</p>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-brand">See offers <ArrowRight className="h-4 w-4" /></span>
        </Link>
      )}
    </div>
  );
}

/** Slim coupon strip (first-order code + live coupons from Admin → Coupons). */
export function CouponChips({ coupons }: { coupons: PublicCoupon[] }) {
  const others = coupons.filter((c) => c.code !== SITE.firstOrderCode).slice(0, 3);
  const items = [{ code: SITE.firstOrderCode, title: "15% off your first order", note: "up to ₹300" }, ...others.map((c) => ({ code: c.code, title: couponTitle(c), note: c.badgeText ?? "" }))];
  return (
    <div className="no-scrollbar -mx-4 mb-6 flex gap-3 overflow-x-auto px-4 md:mx-0 md:px-0">
      {items.map((c) => (
        <div key={c.code} className="flex shrink-0 items-center gap-3 rounded-2xl border border-dashed border-brand/30 bg-brand-soft/60 py-2 pl-4 pr-2">
          <span className="leading-tight">
            <span className="block text-sm font-bold text-ink">{c.title}</span>
            {c.note && <span className="text-xs text-muted">{c.note}</span>}
          </span>
          <CopyCode code={c.code} tone="light" />
        </div>
      ))}
    </div>
  );
}

const DEAL_TABS: { id: "all" | Pet; label: string }[] = [
  { id: "all", label: "All deals" },
  { id: "dog", label: "Dogs" },
  { id: "cat", label: "Cats" },
  { id: "small", label: "Small pets" },
  { id: "parent", label: "Pet parents" },
];

/** Deals rail with pet filter chips (only chips that have products are shown). */
export function DealTabs({ products }: { products: Product[] }) {
  const [tab, setTab] = useState<(typeof DEAL_TABS)[number]["id"]>("all");
  const tabs = DEAL_TABS.filter((t) => t.id === "all" || products.some((p) => p.pet === t.id));
  const shown = tab === "all" ? products : products.filter((p) => p.pet === tab);
  return (
    <div>
      {tabs.length > 2 && (
        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="tablist" aria-label="Filter deals">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition ${tab === t.id ? "border-brand bg-brand text-white" : "border-line bg-white text-ink hover:border-brand/40"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <Rail key={tab}>{shown.map((p) => <ProductCard key={p.id} product={p} />)}</Rail>
    </div>
  );
}

export function Countdown({ className = "" }: { className?: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      setLeft(Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  const parts = left === null ? ["--", "--", "--"] : [Math.floor(left / 3600), Math.floor((left % 3600) / 60), left % 60].map((n) => String(n).padStart(2, "0"));
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-label="Time left">
      {parts.map((p, k) => (
        <span key={k} className="flex items-center gap-1">
          <span className="min-w-[2.1rem] rounded-lg bg-brand px-1.5 py-1 text-center text-sm font-bold tabular-nums text-white">{p}</span>
          <span className="text-[10px] font-bold uppercase text-muted">{["h", "m", "s"][k]}</span>
        </span>
      ))}
    </span>
  );
}
