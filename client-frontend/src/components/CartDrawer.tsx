"use client";

import Link from "next/link";
import { useEffect } from "react";
import { X, Minus, Plus, Trash2, ShoppingBag, Truck, Check } from "lucide-react";
import { ProductVisual } from "./ProductArt";
import { btn } from "./ui";
import { formatINR } from "@/lib/api";
import { useStore } from "@/lib/store";

export default function CartDrawer() {
  const { cart, cartOpen, setCartOpen, subtotal, mrpTotal, setQty, removeFromCart, toast, config } = useStore();
  const left = Math.max(config.freeShippingMin - subtotal, 0);
  const pct = Math.min((subtotal / config.freeShippingMin) * 100, 100);

  useEffect(() => {
    document.body.style.overflow = cartOpen ? "hidden" : "";
    if (!cartOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCartOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartOpen, setCartOpen]);

  return (
    <>
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 md:bottom-8" role="status" aria-live="polite">
          <div className="animate-fade-up flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-lift">
            <Check className="h-4 w-4 text-accent" /> {toast}
          </div>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-[65]" role="dialog" aria-modal="true" aria-label="Shopping cart">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setCartOpen(false)} />
          <aside className="animate-fade-up absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-cream shadow-lift">
            <div className="flex items-center justify-between border-b border-line bg-white px-5 py-4">
              <h2 className="font-display text-xl text-brand">Your cart ({cart.reduce((s, c) => s + c.qty, 0)})</h2>
              <button onClick={() => setCartOpen(false)} aria-label="Close cart" className="grid h-9 w-9 place-items-center rounded-full hover:bg-sand">
                <X className="h-5 w-5" />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="grid h-20 w-20 place-items-center rounded-full bg-sand">
                  <ShoppingBag className="h-9 w-9 text-brand" />
                </div>
                <p className="mt-4 font-display text-xl text-brand">Your cart is empty</p>
                <p className="mt-1 text-sm text-muted">Your pet is waiting for something nice.</p>
                <Link href="/pets/dogs" onClick={() => setCartOpen(false)} className={`${btn.primary} mt-6`}>Start shopping</Link>
              </div>
            ) : (
              <>
                <div className="border-b border-line bg-white px-5 py-3">
                  <p className="flex items-center gap-2 text-sm">
                    <Truck className="h-4 w-4 text-accent" />
                    {left > 0 ? (
                      <span>Add <b>{formatINR(left)}</b> more for <b className="text-brand">free delivery</b></span>
                    ) : (
                      <span className="font-semibold text-brand">You’ve unlocked free delivery 🎉</span>
                    )}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <ul className="flex-1 space-y-3 overflow-y-auto p-4">
                  {cart.map((c) => (
                    <li key={c.variantId} className="flex gap-3 rounded-2xl bg-white p-3 shadow-soft">
                      <Link href={`/products/${c.snap.slug}`} onClick={() => setCartOpen(false)}>
                        <ProductVisual image={c.snap.image} kind={c.snap.kind} tint={c.snap.tint} brand={c.snap.brand} className="h-20 w-20 rounded-xl" />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <p className="line-clamp-2 text-sm font-semibold">{c.snap.name}</p>
                        <p className="text-xs text-muted">{c.snap.brand} · {c.snap.label}</p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="flex items-center rounded-full border border-line">
                            <button onClick={() => setQty(c.variantId, c.qty - 1)} className="grid h-8 w-8 place-items-center" aria-label="Decrease">
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-6 text-center text-sm font-bold">{c.qty}</span>
                            <button onClick={() => setQty(c.variantId, c.qty + 1)} className="grid h-8 w-8 place-items-center" aria-label="Increase">
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <span className="text-right">
                            <span className="block text-sm font-extrabold">{formatINR(c.snap.price * c.qty)}</span>
                            {c.snap.mrp > c.snap.price && <span className="text-xs text-muted line-through">{formatINR(c.snap.mrp * c.qty)}</span>}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => removeFromCart(c.variantId)} className="self-start p-1 text-muted hover:text-red-600" aria-label="Remove">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-line bg-white p-5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Subtotal</span>
                    <span className="font-extrabold">{formatINR(subtotal)}</span>
                  </div>
                  {mrpTotal > subtotal && <p className="mt-1 text-right text-xs font-semibold text-accent">You save {formatINR(mrpTotal - subtotal)}</p>}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link href="/cart" onClick={() => setCartOpen(false)} className={btn.ghost}>View cart</Link>
                    <Link href="/checkout" onClick={() => setCartOpen(false)} className={btn.primary}>Checkout</Link>
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
