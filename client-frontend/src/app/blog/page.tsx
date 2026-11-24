import Link from "next/link";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui";
import { POSTS } from "@/data/content";
import { BLOG_PHOTOS } from "@/data/images";

export const metadata: Metadata = { title: "Pet Guides & Blog" };

export default function BlogPage() {
  const [featured, ...rest] = POSTS;
  const cats = Array.from(new Set(POSTS.map((p) => p.category)));
  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Pet Guides" }]} />
      <h1 className="font-display text-4xl font-semibold text-brand md:text-5xl">Pet guides</h1>
      <p className="mt-2 max-w-xl text-ink/70">Practical, friendly advice on food, health, training and everyday pet life.</p>
      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto">
        {cats.map((c) => <span key={c} className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-soft">{c}</span>)}
      </div>

      <Link href={`/blog/${featured.slug}`} className="group mt-8 grid overflow-hidden rounded-[32px] bg-white shadow-soft md:grid-cols-2">
        <div className="min-h-60 overflow-hidden" style={{ background: featured.tint }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BLOG_PHOTOS[featured.slug]} alt="" className="h-full min-h-60 w-full object-cover transition duration-500 group-hover:scale-105" />
        </div>
        <div className="flex flex-col justify-center p-7 md:p-10">
          <p className="text-xs font-bold uppercase tracking-wider text-brand">Featured · {featured.category}</p>
          <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-brand group-hover:text-accent">{featured.title}</h2>
          <p className="mt-3 text-ink/70">{featured.excerpt}</p>
          <p className="mt-4 text-sm text-muted">{featured.read} read</p>
        </div>
      </Link>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`} className="group overflow-hidden rounded-3xl bg-white shadow-soft transition hover:shadow-lift">
            <div className="aspect-[16/9] overflow-hidden" style={{ background: p.tint }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BLOG_PHOTOS[p.slug]} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            </div>
            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-accent">{p.category} · {p.read}</p>
              <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-brand group-hover:text-accent">{p.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-muted">{p.excerpt}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
