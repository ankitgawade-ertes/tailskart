"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X, ChevronDown, PackageSearch, Loader2 } from "lucide-react";
import ProductCard from "./ProductCard";
import { btn } from "./ui";
import { api, qs } from "@/lib/api";
import type { ProductList } from "@/lib/types";

export interface Chip {
  label: string;
  params: Record<string, string>;
}

type SortKey = "popular" | "price_asc" | "price_desc" | "discount" | "rating" | "new";
const SORTS: [SortKey, string][] = [
  ["popular", "Popularity"],
  ["price_asc", "Price: Low to High"],
  ["price_desc", "Price: High to Low"],
  ["discount", "Biggest discount"],
  ["rating", "Top rated"],
  ["new", "What's new"],
];

// Ranges in paise.
const PRICE_BANDS: [string, string][] = [
  ["Under ₹300", "0-29900"],
  ["₹300 – ₹700", "30000-70000"],
  ["₹700 – ₹1,500", "70100-150000"],
  ["₹1,500 – ₹3,000", "150100-300000"],
  ["Above ₹3,000", "300100-100000000"],
];

const FACETS = [
  ["lifeStage", "Life stage"],
  ["breedSize", "Breed size"],
  ["diet", "Veg / Non-veg"],
  ["flavour", "Flavour"],
  ["brand", "Brand"],
] as const;
type FacetKey = (typeof FACETS)[number][0];

interface Filters {
  brand: string[];
  lifeStage: string[];
  breedSize: string[];
  diet: string[];
  flavour: string[];
  price: string[];
  rating4: boolean;
  discounted: boolean;
}
const EMPTY: Filters = { brand: [], lifeStage: [], breedSize: [], diet: [], flavour: [], price: [], rating4: false, discounted: false };
const PAGE = 24;

export default function ProductListing({ base, initial, chips }: { base: Record<string, string>; initial: ProductList; chips?: Chip[] }) {
  const [f, setF] = useState<Filters>(EMPTY);
  const [sort, setSort] = useState<SortKey>("popular");
  const [chip, setChip] = useState<number | null>(null);
  const [data, setData] = useState<ProductList>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState(false);
  const first = useRef(true);

  const params = (page: number) =>
    qs({
      ...base,
      ...(chip !== null && chips ? chips[chip].params : {}),
      brand: f.brand.length ? f.brand : base.brand,
      lifeStage: f.lifeStage,
      breedSize: f.breedSize,
      diet: f.diet,
      flavour: f.flavour,
      price: f.price.length ? f.price : base.price,
      minRating: f.rating4 ? 4.5 : undefined,
      discounted: f.discounted ? "true" : undefined,
      sort,
      page,
      limit: PAGE,
    });

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    api<ProductList>(`/products${params(1)}`, { signal: ctrl.signal })
      .then(setData)
      .catch((e) => (e as Error).name !== "AbortError" && setError((e as Error).message))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, sort, chip]);

  const loadMore = async () => {
    setLoading(true);
    try {
      const next = await api<ProductList>(`/products${params(data.page + 1)}&facets=false`);
      setData((d) => ({ ...next, items: [...d.items, ...next.items], facets: d.facets }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key: FacetKey | "price", val: string) =>
    setF((prev) => ({ ...prev, [key]: prev[key].includes(val) ? prev[key].filter((x) => x !== val) : [...prev[key], val] }));

  const active: { label: string; clear: () => void }[] = [
    ...(["brand", "lifeStage", "breedSize", "diet", "flavour"] as FacetKey[]).flatMap((k) => f[k].map((v) => ({ label: v, clear: () => toggle(k, v) }))),
    ...f.price.map((v) => ({ label: PRICE_BANDS.find((b) => b[1] === v)?.[0] ?? v, clear: () => toggle("price", v) })),
    ...(f.rating4 ? [{ label: "4.5★ & above", clear: () => setF((p) => ({ ...p, rating4: false })) }] : []),
    ...(f.discounted ? [{ label: "10%+ off", clear: () => setF((p) => ({ ...p, discounted: false })) }] : []),
  ];

  const facets = data.facets ?? initial.facets;

  const panel = (
    <div className="space-y-1">
      <Group title="Price">
        {PRICE_BANDS.map(([label, val]) => (
          <Check key={val} label={label} checked={f.price.includes(val)} onChange={() => toggle("price", val)} />
        ))}
      </Group>
      {FACETS.map(([key, title]) => {
        const values = facets?.[key] ?? [];
        if (values.length < 2 && !f[key].length) return null;
        return (
          <Group key={key} title={title} closed={key === "flavour"}>
            {values.map(({ value, count }) => (
              <Check key={value} label={value} count={count} checked={f[key].includes(value)} onChange={() => toggle(key, value)} />
            ))}
          </Group>
        );
      })}
      <Group title="More">
        <Check label="4.5★ & above" checked={f.rating4} onChange={() => setF({ ...f, rating4: !f.rating4 })} />
        <Check label="10% off or more" checked={f.discounted} onChange={() => setF({ ...f, discounted: !f.discounted })} />
      </Group>
    </div>
  );

  return (
    <div>
      {chips && chips.length > 0 && (
        <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ChipBtn active={chip === null} onClick={() => setChip(null)}>All</ChipBtn>
          {chips.map((c, i) => (
            <ChipBtn key={c.label} active={chip === i} onClick={() => setChip(chip === i ? null : i)}>
              {c.label}
            </ChipBtn>
          ))}
        </div>
      )}

      <div className="flex gap-8">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-36 max-h-[calc(100vh-10rem)] overflow-y-auto rounded-2xl border border-line bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-bold text-brand">Filters</p>
              {active.length > 0 && (
                <button onClick={() => setF(EMPTY)} className="text-xs font-semibold text-brand">Clear all</button>
              )}
            </div>
            {panel}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-muted">
              <b className="text-ink">{data.total}</b> products {loading && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setDrawer(true)} className="flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold lg:hidden">
                <SlidersHorizontal className="h-4 w-4" /> Filters {active.length > 0 && <span className="rounded-full bg-brand px-1.5 text-[10px] text-white">{active.length}</span>}
              </button>
              <label className="relative">
                <span className="sr-only">Sort by</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="appearance-none rounded-full border border-line bg-white py-2 pl-4 pr-9 text-sm font-semibold outline-none focus:border-accent"
                >
                  {SORTS.map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              </label>
            </div>
          </div>

          {active.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {active.map((a) => (
                <button key={a.label} onClick={a.clear} className="flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-brand">
                  {a.label} <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}

          {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          {data.items.length === 0 && !loading ? (
            <div className="rounded-3xl bg-white p-12 text-center">
              <PackageSearch className="mx-auto h-12 w-12 text-muted" />
              <p className="mt-3 font-display text-xl text-brand">No products match these filters</p>
              {(active.length > 0 || chip !== null) && (
                <button
                  onClick={() => {
                    setF(EMPTY);
                    setChip(null);
                  }}
                  className={`${btn.dark} mt-5`}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={`grid grid-cols-2 gap-3 transition-opacity md:grid-cols-3 md:gap-4 xl:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
                {data.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              {data.items.length < data.total && (
                <div className="mt-8 text-center">
                  <p className="mb-3 text-sm text-muted">Showing {data.items.length} of {data.total}</p>
                  <button onClick={loadMore} disabled={loading} className={btn.ghost}>
                    {loading ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
          <div className="animate-fade-up absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-white">
            <div className="flex items-center justify-between border-b border-line p-4">
              <p className="font-bold text-brand">Filters</p>
              <button onClick={() => setDrawer(false)} aria-label="Close filters">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{panel}</div>
            <div className="grid grid-cols-2 gap-2 border-t border-line p-4">
              <button onClick={() => setF(EMPTY)} className={btn.ghost}>Clear</button>
              <button onClick={() => setDrawer(false)} className={btn.primary}>Show {data.total}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Group({ title, children, closed }: { title: string; children: React.ReactNode; closed?: boolean }) {
  return (
    <details open={!closed} className="group border-b border-line/70 py-3 last:border-0">
      <summary className="flex cursor-pointer items-center justify-between text-sm font-bold text-ink">
        {title}
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <div className="mt-2 space-y-1">{children}</div>
    </details>
  );
}

function Check({ label, count, checked, onChange }: { label: string; count?: number; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1 text-sm hover:bg-cream">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-[#2438c8]" />
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-xs text-muted">{count}</span>}
    </label>
  );
}

function ChipBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
        active ? "border-brand bg-brand text-white" : "border-line bg-white text-ink hover:border-brand/40"
      }`}
    >
      {children}
    </button>
  );
}
