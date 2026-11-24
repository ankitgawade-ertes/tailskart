import Link from "next/link";
import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import ProductListing from "@/components/ProductListing";
import { Breadcrumbs, btn } from "@/components/ui";
import { PRICE_LABELS, categoryTitle } from "@/data/pets";
import { qs, serverGetSafe } from "@/lib/api";
import type { Category, ProductList } from "@/lib/types";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

type Params = { q?: string; brand?: string; price?: string };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const brand = (sp.brand ?? "").trim().slice(0, 80);
  const price = sp.price && /^\d+-\d+$/.test(sp.price) ? sp.price : "";
  const base: Record<string, string> = { ...(q ? { q } : {}), ...(brand ? { brand } : {}), ...(price ? { price } : {}) };
  const hasQuery = Object.keys(base).length > 0;
  const empty: ProductList = { items: [], total: 0, page: 1, limit: 24 };
  const [results, cats] = await Promise.all([
    hasQuery ? serverGetSafe<ProductList>(`/products${qs({ ...base, limit: 24 })}`, empty, 30) : Promise.resolve(empty),
    serverGetSafe<{ items: Category[] }>("/categories", { items: [] }, 300),
  ]);
  const title = q ? <>Results for “{q}”</> : brand ? brand : price ? (PRICE_LABELS[price] ?? "Shop by price") : "Search";
  const crumb = q ? "Search" : brand ? "Brands" : price ? "Shop by price" : "Search";

  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: crumb }]} />
      <h1 className="font-display text-3xl font-semibold text-brand">{title}</h1>
      <p className="mb-6 mt-1 text-sm text-muted">{results.total} products found</p>
      {results.total > 0 ? (
        <ProductListing key={JSON.stringify(base)} base={base} initial={results} />
      ) : (
        <div className="rounded-3xl bg-white p-10 text-center shadow-soft">
          <SearchX className="mx-auto h-12 w-12 text-muted" />
          <p className="mt-3 font-display text-2xl text-brand">{q ? <>We couldn’t find “{q}”</> : hasQuery ? "Nothing here yet" : "What are you looking for?"}</p>
          <p className="mt-1 text-sm text-muted">Check the spelling or try one of these categories.</p>
          <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
            {cats.items.slice(0, 10).map((c) => (
              <Link key={c.slug} href={`/collections/${c.slug}`} className="rounded-full bg-cream px-4 py-2 text-sm font-semibold hover:bg-accent-soft">
                {categoryTitle(c)}
              </Link>
            ))}
          </div>
          <Link href="/" className={`${btn.dark} mt-8`}>Back to home</Link>
        </div>
      )}
    </div>
  );
}
