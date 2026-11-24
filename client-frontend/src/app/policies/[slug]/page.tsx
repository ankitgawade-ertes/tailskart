import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui";
import { POLICIES } from "@/data/content";
import { CmsBody } from "@/components/CmsBody";
import { getCmsPage, parseBlocks, updatedLabel } from "@/lib/cms";

async function findPolicy(slug: string) {
  const cms = await getCmsPage(slug);
  if (cms) return { title: cms.title, updated: updatedLabel(cms.updatedAt), body: parseBlocks(cms.body) };
  return POLICIES[slug] ?? null;
}

export function generateStaticParams() {
  return Object.keys(POLICIES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await findPolicy((await params).slug);
  return p ? { title: p.title } : {};
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = await findPolicy(slug);
  if (!policy) notFound();
  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: policy.title }]} />
      <div className="grid gap-8 lg:grid-cols-4">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col">
          {Object.entries(POLICIES).map(([k, p]) => (
            <Link key={k} href={`/policies/${k}`} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold lg:rounded-xl ${k === slug ? "bg-brand text-white" : "bg-white text-ink/80 hover:bg-accent-soft"}`}>
              {p.title}
            </Link>
          ))}
        </nav>
        <article className="rounded-[32px] bg-white p-7 shadow-soft md:p-10 lg:col-span-3">
          <h1 className="font-display text-3xl font-semibold text-brand md:text-4xl">{policy.title}</h1>
          <p className="mt-1 text-sm text-muted">Last updated: {policy.updated}</p>
          <CmsBody blocks={policy.body} className="prose-tk mt-6" />
        </article>
      </div>
    </div>
  );
}
