"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart, Plus, Minus, ShoppingBag, FileUp } from "lucide-react";
import { ProductVisual } from "./ProductArt";
import { Stars } from "./ui";
import { discountPct, formatINR, per100g } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useStore } from "@/lib/store";

const badgeStyle: Record<string, string> = {
  Bestseller: "bg-brand text-white",
  New: "bg-accent text-white",
  "Tailskart Pick": "bg-brand-soft text-brand",
  Deal: "bg-sun text-ink",
};

export default function ProductCard({ product }: { product: Product }) {
  const firstInStock = Math.max(0, product.variants.findIndex((v) => v.inStock));
  const [vi, setVi] = useState(firstInStock);
  const { addToCart, toggleWishlist, wishlist, cart, setQty } = useStore();
  const v = product.variants[vi] ?? product.variants[0];
  if (!v) return null;
  const off = discountPct(v);
  const inCart = cart.find((c) => c.variantId === v.id);
  const saved = wishlist.includes(product.id);
  const unit = per100g(v);
  const allOut = product.variants.every((x) => !x.inStock);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-line/70 bg-white transition hover:-translate-y-1 hover:border-brand/25 hover:shadow-lift">
      <Link href={`/products/${product.slug}`} className="relative m-2 mb-0 block aspect-square overflow-hidden rounded-2xl bg-cream" aria-label={product.name}>
        <ProductVisual
          image={product.images[0]?.url}
          alt={product.images[0]?.alt || product.name}
          kind={product.kind}
          tint={product.tint}
          brand={product.brand}
          className="h-full w-full transition duration-500 group-hover:scale-[1.04]"
        />
        <span className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1">
          {off > 0 && <span className="rounded-lg bg-sun px-2 py-1 text-[11px] font-extrabold text-ink">{off}% OFF</span>}
          {product.badge && <span className={`rounded-lg px-2 py-1 text-[11px] font-bold ${badgeStyle[product.badge]}`}>{product.badge}</span>}
          {product.rx && <span className="rounded-lg bg-pharko px-2 py-1 text-[11px] font-bold text-white">Rx · Prescription</span>}
        </span>
        {allOut && <span className="absolute inset-x-3 bottom-3 rounded-full bg-ink/80 py-1 text-center text-xs font-bold text-white">Out of stock</span>}
      </Link>
      <button
        onClick={() => toggleWishlist(product.id)}
        aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
        className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl bg-white/90 shadow-soft backdrop-blur transition hover:scale-105"
      >
        <Heart className={`h-[18px] w-[18px] ${saved ? "fill-brand text-brand" : "text-brand"}`} />
      </button>

      <div className="flex flex-1 flex-col gap-2 p-3.5 md:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-bold uppercase tracking-wider text-accent">{product.brand}</span>
          {product.reviewCount > 0 ? (
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
              <Stars rating={product.rating} size={11} />
              <span className="hidden sm:inline">({product.reviewCount > 999 ? `${(product.reviewCount / 1000).toFixed(1)}k` : product.reviewCount})</span>
            </span>
          ) : null}
        </div>
        <Link href={`/products/${product.slug}`} className="line-clamp-2 min-h-[2.6em] text-sm font-semibold leading-snug text-ink hover:text-brand">
          {product.name}
        </Link>

        {product.variants.length > 1 && (
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
            {product.variants.map((x, i) => (
              <button
                key={x.id}
                onClick={() => setVi(i)}
                className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                  i === vi ? "border-brand bg-brand text-white" : "border-line bg-cream text-ink hover:border-brand/40"
                } ${x.inStock ? "" : "line-through opacity-60"}`}
              >
                {x.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto pt-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="tabular text-lg font-extrabold text-ink">{formatINR(v.price)}</span>
            {off > 0 && <span className="tabular text-xs text-muted line-through">MRP {formatINR(v.mrp)}</span>}
          </div>
          <p className="text-[11px] text-muted">
            {off > 0 && <span className="font-bold text-accent">Save {formatINR(v.mrp - v.price)}</span>}
            {off > 0 && unit !== null && " · "}
            {unit !== null && <>{formatINR(unit)}/100g</>}
          </p>
        </div>

        {product.rx ? (
          <Link
            href={`/pharko?medicine=${encodeURIComponent(`${product.brand} ${product.name}`)}#upload`}
            className="flex items-center justify-center gap-2 rounded-full bg-pharko py-2.5 text-sm font-bold text-white transition hover:brightness-110"
          >
            <FileUp className="h-4 w-4" /> Upload prescription
          </Link>
        ) : inCart ? (
          <div className="flex items-center justify-between rounded-full bg-brand p-1 text-white">
            <button onClick={() => setQty(v.id, inCart.qty - 1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/15" aria-label="Decrease">
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold">{inCart.qty} in cart</span>
            <button
              onClick={() => setQty(v.id, inCart.qty + 1)}
              disabled={inCart.qty >= Math.min(10, v.stock)}
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/15 disabled:opacity-40"
              aria-label="Increase"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => addToCart(product, v)}
            disabled={!v.inStock}
            className="flex items-center justify-center gap-2 rounded-full bg-brand py-2.5 text-sm font-bold text-white transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-sand disabled:text-muted"
          >
            {v.inStock && <ShoppingBag className="h-4 w-4" />}
            {v.inStock ? "Add to cart" : "Out of stock"}
          </button>
        )}
      </div>
    </article>
  );
}
