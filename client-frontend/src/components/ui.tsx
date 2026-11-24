import Link from "next/link";
import { Star, ChevronRight } from "lucide-react";

/**
 * The tailskart wordmark: lowercase, one uninterrupted word (brand book p.8).
 * Typeset in DM Sans Bold until the commissioned vector master is supplied — then swap in the SVG here.
 */
export function Logo({ tone = "brand", className = "text-2xl" }: { tone?: "brand" | "white" | "ink"; className?: string }) {
  const color = tone === "white" ? "text-white" : tone === "ink" ? "text-ink" : "text-brand";
  return (
    <span className={`${className} ${color} inline-block font-bold lowercase leading-none tracking-[-0.03em]`} aria-label="tailskart">
      tailskart
    </span>
  );
}

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          width={size}
          height={size}
          className={i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-line text-line"}
        />
      ))}
    </span>
  );
}

export function SectionHeading({
  title,
  eyebrow,
  subtitle,
  href,
  linkText = "See all",
  center,
  tone = "brand",
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  href?: string;
  linkText?: string;
  center?: boolean;
  tone?: "brand" | "white";
}) {
  const white = tone === "white";
  return (
    <div className={`mb-6 flex gap-4 md:mb-8 ${center ? "flex-col items-center text-center" : "items-end justify-between"}`}>
      <div className={center ? "max-w-2xl" : ""}>
        {eyebrow && (
          <p className={`mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] ${white ? "text-fold" : "text-accent"}`}>
            <span className={`h-[3px] w-5 rounded-full ${white ? "bg-fold" : "bg-accent"}`} aria-hidden />
            {eyebrow}
          </p>
        )}
        <h2 className={`font-display text-[1.65rem] font-bold leading-tight md:text-[2.35rem] ${white ? "text-white" : "text-ink"}`}>{title}</h2>
        {subtitle && <p className={`mt-2 text-sm md:text-base ${white ? "text-white/75" : "text-muted"}`}>{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className={`group inline-flex shrink-0 items-center gap-1 rounded-full border px-4 py-2 text-sm font-bold transition ${
            white ? "border-white/30 text-white hover:bg-white/10" : "border-brand/20 bg-white text-brand hover:border-brand hover:bg-accent-soft"
          }`}
        >
          {linkText}
          <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="no-scrollbar overflow-x-auto py-4 text-sm text-muted">
      <ol className="flex items-center gap-1.5 whitespace-nowrap">
        <li>
          <Link href="/" className="hover:text-brand">Home</Link>
        </li>
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 opacity-50" />
            {it.href ? (
              <Link href={it.href} className="hover:text-brand">{it.label}</Link>
            ) : (
              <span className="font-medium text-ink">{it.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHero({ title, subtitle, tint = "#eceff7", emoji, image }: { title: string; subtitle?: string; tint?: string; emoji?: string; image?: string | null }) {
  if (image) {
    // Photo banner: same ultramarine wash as the homepage hero.
    return (
      <section className="relative flex min-h-[220px] items-end overflow-hidden rounded-3xl bg-brand-deep px-6 py-9 md:min-h-[280px] md:items-center md:px-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-deep/95 via-brand/60 to-transparent" />
        <div className="relative z-10 max-w-2xl text-white">
          <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">{title}</h1>
          {subtitle && <p className="mt-3 text-base text-white/85 md:text-lg">{subtitle}</p>}
        </div>
      </section>
    );
  }
  return (
    <section className="relative overflow-hidden rounded-3xl px-6 py-10 md:px-12 md:py-14" style={{ background: tint }}>
      <div className="relative z-10 max-w-2xl">
        <h1 className="font-display text-4xl font-bold leading-tight text-ink md:text-6xl">{title}</h1>
        {subtitle && <p className="mt-3 text-base text-ink/70 md:text-lg">{subtitle}</p>}
      </div>
      {emoji && (
        <span aria-hidden className="absolute -bottom-6 right-4 select-none text-[110px] opacity-90 md:right-12 md:text-[160px]">
          {emoji}
        </span>
      )}
    </section>
  );
}

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white shadow-[0_8px_20px_-8px_rgb(36_56_200/0.45)] transition hover:bg-[#1a2a9c] active:scale-[0.98] disabled:opacity-50",
  dark: "inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-deep active:scale-[0.98] disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-full border border-brand/20 bg-white px-6 py-3 text-sm font-bold text-brand transition hover:border-brand hover:bg-accent-soft",
};

export const input =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15";
