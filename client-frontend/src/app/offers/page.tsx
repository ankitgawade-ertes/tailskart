import type { Metadata } from "next";
import { Tag } from "lucide-react";
import ProductListing from "@/components/ProductListing";
import { Countdown } from "@/components/HomeBits";
import { Breadcrumbs } from "@/components/ui";
import { formatINR, serverGet, serverGetSafe } from "@/lib/api";
import type { ProductList } from "@/lib/types";

export const metadata: Metadata = { title: "Offers & Deals" };

interface PublicCoupon {
  code: string;
  description: string;
  type: "PERCENT" | "FLAT" | "BXGY";
  value: number;
  buyQty?: number | null;
  getQty?: number | null;
  scope?: "ALL" | "CATEGORY" | "BRAND" | "PRODUCT";
  minQty?: number;
  badgeText?: string | null;
  maxDiscount: number | null;
  minOrder: number;
  firstOrderOnly: boolean;
  endsAt: string | null;
}

const TINTS = ["#eef1fd", "#e7f3fd", "#e3f0fb"];

export default async function OffersPage() {
  const [initial, coupons] = await Promise.all([
    serverGet<ProductList>("/products?onSale=true&sort=discount&limit=24"),
    serverGetSafe<{ items: PublicCoupon[] }>("/coupons", { items: [] }),
  ]);
  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Offers" }]} />
      <section className="relative overflow-hidden fold-band rounded-[32px] px-6 py-10 text-white md:px-12 md:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-fold">Offer zone</p>
        <h1 className="mt-2 max-w-xl font-display text-4xl font-semibold md:text-6xl">Today’s best deals for your pet</h1>
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 text-ink md:inline-flex">
          <span className="text-sm font-semibold">Today’s deals end in</span>
          <Countdown />
        </div>
        <span aria-hidden className="absolute -bottom-8 right-4 text-[130px] md:right-16 md:text-[200px]">🏷️</span>
      </section>

      {coupons.items.length > 0 && (
        <section className="mt-8 grid gap-3 md:grid-cols-3">
          {coupons.items.map((c, i) => (
            <div key={c.code} className="flex items-center gap-4 rounded-2xl border border-dashed border-brand/25 p-5" style={{ background: TINTS[i % TINTS.length] }}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white">
                <Tag className="h-6 w-6 text-brand" />
              </span>
              <div className="min-w-0">
                <p className="font-bold text-brand">{c.type === "BXGY" ? `Buy ${c.buyQty}, get ${c.getQty} free` : c.type === "PERCENT" ? `${c.value}% off` : `Flat ${formatINR(c.value)} off`}</p>
                <p className="text-xs text-muted">
                  {c.description ||
                    [c.scope && c.scope !== "ALL" ? "On selected items" : null, c.minQty ? `Min ${c.minQty} items` : null, c.minOrder ? `On orders above ${formatINR(c.minOrder)}` : null, c.maxDiscount ? `max ${formatINR(c.maxDiscount)}` : null, c.firstOrderOnly ? "first order only" : null]
                      .filter(Boolean)
                      .join(" · ")}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="inline-block rounded-md bg-white px-2 py-0.5 text-xs font-bold tracking-widest text-brand">{c.code}</span>
                  {c.badgeText && <span className="inline-block rounded-md bg-sun px-2 py-0.5 text-[11px] font-bold text-ink">{c.badgeText}</span>}
                </p>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-4 font-display text-2xl font-semibold text-brand">On sale now</h2>
        <ProductListing
          base={{ onSale: "true" }}
          initial={initial ?? { items: [], total: 0, page: 1, limit: 24 }}
          chips={[
            { label: "Dogs", params: { pet: "dog" } },
            { label: "Cats", params: { pet: "cat" } },
            { label: "Small pets", params: { pet: "small" } },
            { label: "Pet parents", params: { pet: "parent" } },
          ]}
        />
      </section>
    </div>
  );
}
