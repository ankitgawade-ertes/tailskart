import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductCard from "@/components/ProductCard";
import { Breadcrumbs } from "@/components/ui";
import { serverGetSafe } from "@/lib/api";
import type { ProductList } from "@/lib/types";
import { POSTS } from "@/data/content";
import { BLOG_PHOTOS } from "@/data/images";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = POSTS.find((x) => x.slug === slug);
  return p ? { title: p.title, description: p.excerpt } : {};
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = POSTS.find((x) => x.slug === slug);
  if (!post) notFound();
  const others = POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);
  const picks = await serverGetSafe<ProductList>("/products?badge=Bestseller&limit=3&facets=false", { items: [], total: 0, page: 1, limit: 3 });

  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Pet Guides", href: "/blog" }, { label: post.category }]} />
      <article className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-wider text-brand">{post.category} · {post.read} read</p>
        <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-brand md:text-5xl">{post.title}</h1>
        <p className="mt-3 text-sm text-muted">
          By the Tailskart pet care team · {new Date(post.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BLOG_PHOTOS[post.slug]} alt="" className="mt-6 aspect-[16/8] w-full rounded-2xl object-cover" style={{ background: post.tint }} />
        <div className="prose-tk mt-8 text-[1.05rem]">
          <p className="!text-lg !text-ink">{post.excerpt}</p>
          {post.body.map((b, i) =>
            b.h ? <h2 key={i}>{b.h}</h2> : b.list ? <ul key={i}>{b.list.map((l) => <li key={l}>{l}</li>)}</ul> : <p key={i}>{b.p}</p>,
          )}
        </div>
        {picks.items.length > 0 && (
        <div className="mt-10 rounded-3xl bg-accent-soft p-6">
          <p className="font-bold text-brand">Popular with pet parents</p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            {picks.items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
        )}
      </article>

      <section className="mx-auto mt-14 max-w-5xl">
        <h2 className="mb-4 font-display text-2xl font-semibold text-brand">Keep reading</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {others.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="group flex items-center gap-4 rounded-3xl bg-white p-4 shadow-soft hover:shadow-lift">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BLOG_PHOTOS[p.slug]} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" style={{ background: p.tint }} />
              <span className="font-semibold leading-snug text-brand group-hover:text-accent">{p.title}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
