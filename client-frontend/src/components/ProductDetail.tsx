"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart, Share2, Truck, BadgeCheck, RotateCcw, Banknote, MapPin, Zap, ChevronDown, Check, Minus, Plus, Tag, Star } from "lucide-react";
import ProductArt from "./ProductArt";
import { Countdown } from "./HomeBits";
import { Stars, btn, input } from "./ui";
import { api, discountPct, formatINR, per100g } from "@/lib/api";
import type { ProductDetail, ReviewList } from "@/lib/types";
import { useStore } from "@/lib/store";

export function Gallery({ product }: { product: ProductDetail }) {
  const [i, setI] = useState(0);
  const imgs = product.images;
  if (!imgs.length) {
    return (
      <div className="relative overflow-hidden rounded-[28px] bg-white shadow-soft">
        <ProductArt kind={product.kind} tint={product.tint} brand={product.brand} className="aspect-square h-full w-full" />
        {product.badge && <span className="absolute left-4 top-4 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">{product.badge}</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row">
      {imgs.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto md:flex-col">
          {imgs.map((img, k) => (
            <button
              key={img.url}
              onClick={() => setI(k)}
              aria-label={`View image ${k + 1}`}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white md:h-20 md:w-20 ${k === i ? "border-brand" : "border-transparent"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}
      <div className="relative flex-1 overflow-hidden rounded-[28px] bg-white shadow-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgs[i].url} alt={imgs[i].alt || product.name} className="aspect-square h-full w-full object-contain" />
        {product.badge && <span className="absolute left-4 top-4 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">{product.badge}</span>}
      </div>
    </div>
  );
}

export function BuyBox({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const { addToCart, toggleWishlist, wishlist, pincode, setPincode, showToast, config } = useStore();
  const [vi, setVi] = useState(Math.max(0, product.variants.findIndex((v) => v.inStock)));
  const [qty, setQty] = useState(1);
  const [pin, setPin] = useState(pincode ?? "");
  const [delivery, setDelivery] = useState<{ pincode: string; serviceable: boolean; sameDay: boolean; etaDays: [number, number] } | null>(null);
  const [pinErr, setPinErr] = useState("");
  const [offersOpen, setOffersOpen] = useState(false);
  const v = product.variants[vi];
  if (!v) return <p className="text-muted">This product is currently unavailable.</p>;
  const off = discountPct(v);
  const saved = wishlist.includes(product.id);
  const maxQty = Math.max(1, Math.min(10, v.stock));

  const checkPin = async () => {
    setPinErr("");
    if (!/^[1-9][0-9]{5}$/.test(pin)) return setPinErr("Enter a valid 6-digit pincode");
    try {
      const r = await api<typeof delivery & object>(`/delivery/check?pincode=${pin}`);
      setDelivery(r);
      if (r.serviceable) setPincode(pin);
    } catch (e) {
      setPinErr((e as Error).message);
    }
  };

  const etaText = (d: NonNullable<typeof delivery>) => {
    if (!d.serviceable) return "Not deliverable yet";
    if (d.sameDay) return "Today, if ordered by 2pm";
    const from = new Date(Date.now() + d.etaDays[0] * 864e5);
    const to = new Date(Date.now() + d.etaDays[1] * 864e5);
    const f = (x: Date) => x.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    return `${f(from)} – ${f(to)}`;
  };

  return (
    <div>
      <p className="text-sm font-bold uppercase tracking-wider text-accent">{product.brand}</p>
      <h1 className="mt-1 font-display text-2xl font-semibold leading-tight text-brand md:text-[2.1rem]">{product.name}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        {product.reviewCount > 0 ? (
          <>
            <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 shadow-soft">
              <Stars rating={product.rating} size={13} /> <b>{product.rating.toFixed(1)}</b>
            </span>
            <a href="#reviews" className="text-muted underline-offset-2 hover:underline">{product.reviewCount.toLocaleString("en-IN")} reviews</a>
          </>
        ) : (
          <a href="#reviews" className="text-muted underline-offset-2 hover:underline">Be the first to review</a>
        )}
        <button
          onClick={async () => {
            try {
              if (navigator.share) await navigator.share({ title: product.name, url: window.location.href });
              else {
                await navigator.clipboard.writeText(window.location.href);
                showToast("Link copied");
              }
            } catch {
              /* share cancelled */
            }
          }}
          className="ml-auto flex items-center gap-1 text-muted hover:text-brand"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
      </div>

      {product.badge === "Deal" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand-soft px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-bold text-brand"><Zap className="h-4 w-4 fill-brand" /> Deal of the day</span>
          <Countdown />
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 text-sm font-bold">Choose size</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {product.variants.map((x, k) => {
            const pct = discountPct(x);
            const unit = per100g(x);
            return (
              <button
                key={x.id}
                onClick={() => {
                  setVi(k);
                  setQty(1);
                }}
                className={`relative rounded-2xl border-2 p-3 text-left transition ${k === vi ? "border-brand bg-accent-soft" : "border-line bg-white hover:border-brand/40"} ${x.inStock ? "" : "opacity-60"}`}
              >
                {k === vi && <Check className="absolute right-2 top-2 h-4 w-4 text-brand" />}
                <span className="block text-sm font-bold">{x.label}</span>
                <span className="block text-base font-extrabold">{formatINR(x.price)}</span>
                {pct > 0 && <span className="text-xs text-muted line-through">{formatINR(x.mrp)}</span>}
                {pct > 0 && <span className="ml-1 text-xs font-bold text-accent">{pct}% off</span>}
                {unit !== null && <span className="mt-0.5 block text-[11px] text-muted">{formatINR(unit)}/100g</span>}
                {!x.inStock ? (
                  <span className="mt-1 block text-[11px] font-bold text-red-600">Out of stock</span>
                ) : x.stock <= 5 ? (
                  <span className="mt-1 block text-[11px] font-bold text-brand">Only {x.stock} left</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex items-end gap-3">
        <span className="text-3xl font-extrabold">{formatINR(v.price)}</span>
        {off > 0 && (
          <>
            <span className="pb-1 text-muted line-through">MRP {formatINR(v.mrp)}</span>
            <span className="mb-1 rounded-md bg-accent px-2 py-0.5 text-xs font-bold text-white">{off}% OFF</span>
          </>
        )}
      </div>
      <p className="text-xs text-muted">Inclusive of all taxes</p>
      {!!product.offers?.length && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {product.offers.map((o) => (
            <li key={o.code} className="flex items-center gap-2 rounded-lg border border-dashed border-brand/30 bg-sun-soft px-2.5 py-1 text-xs">
              <span className="rounded bg-sun px-1.5 py-0.5 font-bold text-ink">{o.badge}</span>
              <span className="text-ink/80">Use code <b className="tracking-wider text-brand">{o.code}</b></span>
            </li>
          ))}
        </ul>
      )}

      {product.rx ? (
        <div className="mt-5 rounded-2xl border border-pharko/30 bg-pharko-soft p-5">
          <p className="flex items-center gap-2 font-bold text-pharko">
            <span className="rounded-md bg-pharko px-2 py-0.5 text-xs text-white">Rx</span> Prescription medicine
          </p>
          <p className="mt-2 text-sm text-ink/80">
            This medicine is dispensed by the pharko pharmacist against a valid vet’s prescription. Upload the prescription and pharko will confirm the dose and price, then
            keep it ready for you.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href={`/pharko?medicine=${encodeURIComponent(`${product.brand} ${product.name}`)}#upload`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-pharko px-6 py-3 text-sm font-bold text-white hover:brightness-110">
              Upload prescription
            </Link>
            <button
              onClick={() => toggleWishlist(product.id)}
              aria-label="Save to wishlist"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-line bg-white hover:border-brand"
            >
              <Heart className={`h-5 w-5 ${saved ? "fill-brand text-brand" : "text-brand"}`} />
            </button>
          </div>
        </div>
      ) : (
      <>
      <div className="mt-5 flex gap-3">
        <div className="flex items-center rounded-full border border-line bg-white">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-12 w-11 place-items-center" aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
          <span className="w-6 text-center font-bold">{qty}</span>
          <button onClick={() => setQty(Math.min(maxQty, qty + 1))} className="grid h-12 w-11 place-items-center" aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
        </div>
        <button onClick={() => addToCart(product, v, qty)} disabled={!v.inStock} className={`${btn.dark} flex-1`}>
          {v.inStock ? "Add to cart" : "Out of stock"}
        </button>
        <button
          onClick={() => toggleWishlist(product.id)}
          aria-label="Save to wishlist"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-line bg-white hover:border-brand"
        >
          <Heart className={`h-5 w-5 ${saved ? "fill-brand text-brand" : "text-brand"}`} />
        </button>
      </div>
      <button
        disabled={!v.inStock}
        onClick={() => {
          addToCart(product, v, qty);
          router.push("/checkout");
        }}
        className={`${btn.primary} mt-3 w-full`}
      >
        Buy now
      </button>
      </>
      )}

      <div className="mt-6 rounded-2xl border border-line bg-white p-4">
        <p className="flex items-center gap-2 text-sm font-bold"><MapPin className="h-4 w-4 text-brand" /> Check delivery</p>
        <div className="mt-3 flex gap-2">
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && checkPin()}
            inputMode="numeric"
            placeholder="Enter pincode"
            aria-label="Pincode"
            className={input}
          />
          <button onClick={checkPin} className="rounded-xl px-4 text-sm font-bold text-accent hover:bg-accent-soft">Check</button>
        </div>
        {pinErr && <p className="mt-2 text-sm text-red-600">{pinErr}</p>}
        {delivery && (
          <p className="mt-3 flex items-center gap-2 text-sm">
            <Truck className="h-4 w-4 text-accent" /> Delivery to <b>{delivery.pincode}</b>: <b className="text-brand">{etaText(delivery)}</b>
          </p>
        )}
        <ul className="mt-3 space-y-1.5 text-xs text-muted">
          <li className="flex items-center gap-2"><Truck className="h-3.5 w-3.5" /> Free delivery on orders above {formatINR(config.freeShippingMin)}</li>
          {config.cod.enabled && (
            <li className="flex items-center gap-2"><Banknote className="h-3.5 w-3.5" /> Cash on delivery for orders {formatINR(config.cod.min)} – {formatINR(config.cod.max)}</li>
          )}
        </ul>
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-white">
        <button onClick={() => setOffersOpen(!offersOpen)} className="flex w-full items-center justify-between p-4 text-sm font-bold">
          <span className="flex items-center gap-2"><Tag className="h-4 w-4 text-brand" /> Offers & coupons</span>
          <ChevronDown className={`h-4 w-4 transition ${offersOpen ? "rotate-180" : ""}`} />
        </button>
        {offersOpen && (
          <p className="border-t border-line p-4 text-sm text-ink/80">
            See today’s coupon codes on the <Link href="/offers" className="font-bold text-accent">Offers page</Link>. Apply a code in your cart before checkout.
          </p>
        )}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
        {[
          [BadgeCheck, "100% genuine"],
          [RotateCcw, "7-day returns"],
          [Truck, "Fast delivery"],
        ].map(([Icon, l]) => {
          const I = Icon as typeof Truck;
          return (
            <div key={l as string} className="rounded-2xl bg-white p-3 shadow-soft">
              <I className="mx-auto h-5 w-5 text-accent" />
              <p className="mt-1 font-semibold">{l as string}</p>
            </div>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-[60px] z-30 flex items-center gap-3 border-t border-line bg-white px-4 py-3 md:hidden">
        <div className="leading-tight">
          <p className="text-lg font-extrabold">{formatINR(v.price)}</p>
          <p className="text-[11px] text-muted">{v.label}</p>
        </div>
        {product.rx ? (
          <Link href={`/pharko?medicine=${encodeURIComponent(`${product.brand} ${product.name}`)}#upload`} className="flex-1 rounded-full bg-pharko py-2.5 text-center text-sm font-bold text-white">
            Upload prescription
          </Link>
        ) : (
          <button onClick={() => addToCart(product, v, qty)} disabled={!v.inStock} className={`${btn.primary} flex-1 py-2.5`}>
            {v.inStock ? "Add to cart" : "Out of stock"}
          </button>
        )}
      </div>
    </div>
  );
}

export function InfoTabs({ product }: { product: ProductDetail }) {
  const { config } = useStore();
  const [tab, setTab] = useState<"desc" | "specs" | "ship">("desc");
  return (
    <div className="rounded-3xl bg-white p-5 shadow-soft md:p-8">
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {[
          ["desc", "Description"],
          ["specs", "Specifications"],
          ["ship", "Delivery & returns"],
        ].map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k as typeof tab)}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-bold transition ${tab === k ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="pt-6">
        {tab === "desc" && (
          <div className="grid gap-8 md:grid-cols-2">
            <div className="prose-tk">
              {product.description.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {product.highlights.length > 0 && (
              <div>
                <p className="mb-3 font-bold text-brand">Why pets love it</p>
                <ul className="space-y-2.5">
                  {product.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft"><Check className="h-3 w-3 text-brand" /></span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {tab === "specs" && (
          <table className="w-full max-w-2xl text-sm">
            <tbody>
              {product.specs.map(([k, val]) => (
                <tr key={k} className="border-b border-line/70 last:border-0">
                  <th className="w-1/3 py-3 pr-4 text-left font-semibold text-muted">{k}</th>
                  <td className="py-3">{val}</td>
                </tr>
              ))}
              <tr>
                <th className="w-1/3 py-3 pr-4 text-left font-semibold text-muted">Sizes</th>
                <td className="py-3">{product.variants.map((x) => x.label).join(", ")}</td>
              </tr>
            </tbody>
          </table>
        )}
        {tab === "ship" && (
          <div className="prose-tk">
            <ul>
              <li>Free delivery on orders above {formatINR(config.freeShippingMin)}; {formatINR(config.shippingFee)} below that.</li>
              <li>Same-day delivery in select pincodes for orders placed before 2pm.</li>
              <li>Unopened items can be returned within 7 days of delivery.</li>
              <li>Damaged or wrong items are replaced free — just share a photo within 48 hours.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function Reviews({ slug, initial }: { slug: string; initial: ReviewList }) {
  const { user } = useStore();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const total = initial.distribution.reduce((a, b) => a + b, 0);

  const submit = async () => {
    setErr("");
    try {
      const r = await api<{ message: string }>(`/products/${slug}/reviews`, { method: "POST", body: { rating, title, body } });
      setMsg(r.message);
      setOpen(false);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <section id="reviews" className="mt-12 scroll-mt-40 rounded-3xl bg-white p-5 shadow-soft md:p-8">
      <div className="grid gap-8 md:grid-cols-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-brand">Customer reviews</h2>
          {initial.count > 0 ? (
            <>
              <div className="mt-4 flex items-center gap-3">
                <span className="font-display text-5xl font-semibold text-brand">{initial.rating.toFixed(1)}</span>
                <span>
                  <Stars rating={initial.rating} size={18} />
                  <span className="block text-sm text-muted">{initial.count.toLocaleString("en-IN")} ratings</span>
                </span>
              </div>
              <div className="mt-5 space-y-2">
                {initial.distribution.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-6 text-muted">{5 - i}★</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${total ? (d / total) * 100 : 0}%` }} />
                    </span>
                    <span className="w-10 text-right text-xs text-muted">{d}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">No reviews yet. Bought this? Tell other pet parents what you think.</p>
          )}
          {msg ? (
            <p className="mt-6 rounded-xl bg-accent-soft px-4 py-3 text-sm font-semibold text-brand">{msg}</p>
          ) : user ? (
            <button onClick={() => setOpen(!open)} className={`${btn.ghost} mt-6 w-full`}>Write a review</button>
          ) : (
            <Link href={`/login?next=/products/${slug}`} className={`${btn.ghost} mt-6 w-full`}>Log in to write a review</Link>
          )}
        </div>
        <div className="md:col-span-2">
          {open && (
            <div className="mb-6 space-y-3 rounded-2xl border border-line p-4">
              <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`} role="radio" aria-checked={rating === n}>
                    <Star className={`h-7 w-7 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-line"}`} />
                  </button>
                ))}
              </div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summary (e.g. My dog loves it)" className={input} maxLength={120} />
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did you and your pet think?" rows={4} className={input} maxLength={2000} />
              {err && <p className="text-sm text-red-600">{err}</p>}
              <button onClick={submit} className={btn.dark}>Submit review</button>
            </div>
          )}
          <ul className="space-y-5">
            {initial.items.map((r) => (
              <li key={r.id} className="border-b border-line pb-5 last:border-0">
                <div className="flex items-center gap-2">
                  <Stars rating={r.rating} size={13} />
                  <b className="text-sm">{r.title}</b>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/80">{r.body}</p>
                <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                  {r.author} · {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  {r.verified && (
                    <span className="flex items-center gap-1 text-accent">
                      · <BadgeCheck className="h-3.5 w-3.5" /> Verified buyer
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
