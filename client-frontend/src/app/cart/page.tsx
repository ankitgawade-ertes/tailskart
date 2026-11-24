"use client";

import Link from "next/link";
import { Minus, Plus, Trash2, Heart, Truck, ShoppingBag, AlertCircle } from "lucide-react";
import OrderSummary from "@/components/OrderSummary";
import { ProductVisual } from "@/components/ProductArt";
import { Breadcrumbs, btn } from "@/components/ui";
import { formatINR } from "@/lib/api";
import { useQuote } from "@/lib/useQuote";
import { useStore } from "@/lib/store";

export default function CartPage() {
  const { cart, setQty, removeFromCart, toggleWishlist, subtotal, config, ready } = useStore();
  const { quote, loading, error } = useQuote();
  const left = Math.max(config.freeShippingMin - subtotal, 0);

  if (!ready) return <div className="container-x py-20 text-center text-muted">Loading your cart…</div>;

  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Cart" }]} />
      <h1 className="font-display text-3xl font-semibold text-brand md:text-4xl">Your cart</h1>

      {cart.length === 0 ? (
        <div className="mt-6 rounded-3xl bg-white p-10 text-center shadow-soft md:p-16">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-sand">
            <ShoppingBag className="h-10 w-10 text-brand" />
          </div>
          <p className="mt-5 font-display text-2xl text-brand">Your cart is feeling a little empty</p>
          <p className="mt-1 text-muted">Add a treat or two — your pet will thank you.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/pets/dogs" className={btn.primary}>Shop for dogs</Link>
            <Link href="/pets/cats" className={btn.ghost}>Shop for cats</Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {quote?.issues.map((i) => (
              <p key={i.variantId} className="flex items-center gap-2 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-brand">
                <AlertCircle className="h-4 w-4" /> {i.message} — we’ve updated your cart.
              </p>
            ))}
            {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm shadow-soft">
              <Truck className="h-4 w-4 text-accent" />
              {left > 0 ? (
                <span>Add <b>{formatINR(left)}</b> more to get <b className="text-brand">free delivery</b></span>
              ) : (
                <span className="font-semibold text-brand">Yay! Your order ships free.</span>
              )}
            </div>
            {cart.map((c) => (
              <div key={c.variantId} className="flex gap-4 rounded-3xl bg-white p-4 shadow-soft">
                <Link href={`/products/${c.snap.slug}`} className="shrink-0">
                  <ProductVisual image={c.snap.image} kind={c.snap.kind} tint={c.snap.tint} brand={c.snap.brand} className="h-24 w-24 rounded-2xl md:h-28 md:w-28" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="text-xs font-bold uppercase tracking-wider text-accent">{c.snap.brand}</p>
                  <Link href={`/products/${c.snap.slug}`} className="line-clamp-2 font-semibold hover:text-brand">{c.snap.name}</Link>
                  <p className="text-sm text-muted">Size: {c.snap.label}</p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                    <div className="flex items-center rounded-full border border-line">
                      <button onClick={() => setQty(c.variantId, c.qty - 1)} className="grid h-9 w-9 place-items-center" aria-label="Decrease"><Minus className="h-4 w-4" /></button>
                      <span className="w-7 text-center font-bold">{c.qty}</span>
                      <button onClick={() => setQty(c.variantId, c.qty + 1)} className="grid h-9 w-9 place-items-center" aria-label="Increase"><Plus className="h-4 w-4" /></button>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <button
                        onClick={() => {
                          toggleWishlist(c.productId);
                          removeFromCart(c.variantId);
                        }}
                        className="flex items-center gap-1 text-muted hover:text-brand"
                      >
                        <Heart className="h-4 w-4" /> <span className="hidden sm:inline">Save for later</span>
                      </button>
                      <button onClick={() => removeFromCart(c.variantId)} className="flex items-center gap-1 text-muted hover:text-red-600">
                        <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-extrabold">{formatINR(c.snap.price * c.qty)}</p>
                  {c.snap.mrp > c.snap.price && <p className="text-xs text-muted line-through">{formatINR(c.snap.mrp * c.qty)}</p>}
                </div>
              </div>
            ))}
          </div>
          <div className="lg:sticky lg:top-36 lg:self-start">
            <OrderSummary quote={quote} loading={loading} cta={<Link href="/checkout" className={`${btn.primary} mt-5 w-full`}>Proceed to checkout</Link>} />
          </div>
        </div>
      )}
    </div>
  );
}
