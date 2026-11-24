"use client";

import { useState } from "react";
import { Tag, ShieldCheck, X, Loader2 } from "lucide-react";
import { input } from "./ui";
import { api, formatINR } from "@/lib/api";
import type { Quote } from "@/lib/types";
import { useStore } from "@/lib/store";

export default function OrderSummary({ quote, loading, cta }: { quote: Quote | null; loading?: boolean; cta?: React.ReactNode }) {
  const { coupon, setCoupon, cart } = useStore();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [checking, setChecking] = useState(false);

  const apply = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setChecking(true);
    setErr("");
    try {
      const q = await api<Quote>("/cart/quote", { method: "POST", body: { items: cart.map((l) => ({ variantId: l.variantId, qty: l.qty })), couponCode: c } });
      if (q.couponError) setErr(q.couponError);
      else {
        setCoupon(c);
        setCode("");
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white p-5 shadow-soft">
        <p className="mb-3 flex items-center gap-2 text-sm font-bold"><Tag className="h-4 w-4 text-brand" /> Apply coupon</p>
        {coupon && quote?.coupon ? (
          <div className="flex items-center justify-between rounded-xl bg-accent-soft px-4 py-3 text-sm">
            <span><b className="tracking-wider text-brand">{quote.coupon.code}</b> applied — you save {formatINR(quote.discount)}</span>
            <button onClick={() => setCoupon(null)} aria-label="Remove coupon"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && apply()} placeholder="Enter code" aria-label="Coupon code" className={`${input} uppercase`} />
              <button onClick={apply} disabled={checking} className="rounded-xl bg-brand px-5 text-sm font-bold text-white disabled:opacity-60">Apply</button>
            </div>
            {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
          </>
        )}
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-soft">
        <p className="mb-4 flex items-center gap-2 font-bold text-brand">Order summary {loading && <Loader2 className="h-4 w-4 animate-spin text-accent" />}</p>
        {quote ? (
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Total MRP</dt><dd>{formatINR(quote.mrpTotal)}</dd></div>
            {quote.mrpTotal > quote.subtotal && (
              <div className="flex justify-between"><dt className="text-muted">Discount on MRP</dt><dd className="text-accent">−{formatINR(quote.mrpTotal - quote.subtotal)}</dd></div>
            )}
            {quote.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Coupon ({quote.coupon?.code})</dt><dd className="text-accent">−{formatINR(quote.discount)}</dd></div>}
            {!!quote.points?.discount && <div className="flex justify-between"><dt className="text-muted">Points ({quote.points.redeemed})</dt><dd className="text-accent">−{formatINR(quote.points.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{quote.shippingFee === 0 ? <span className="font-semibold text-accent">FREE</span> : formatINR(quote.shippingFee)}</dd></div>
            {quote.expressFee > 0 && <div className="flex justify-between"><dt className="text-muted">Express delivery</dt><dd>{formatINR(quote.expressFee)}</dd></div>}
            <div className="flex justify-between border-t border-line pt-3 text-base font-extrabold"><dt>Total</dt><dd>{formatINR(quote.total)}</dd></div>
          </dl>
        ) : (
          <p className="text-sm text-muted">{cart.length ? "Calculating…" : "Your cart is empty"}</p>
        )}
        {quote && quote.mrpTotal - quote.subtotal + quote.discount + (quote.points?.discount ?? 0) > 0 && (
          <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-center text-xs font-bold text-brand">
            You’re saving {formatINR(quote.mrpTotal - quote.subtotal + quote.discount + (quote.points?.discount ?? 0))} on this order 🎉
          </p>
        )}
        {cta}
      </div>
      <p className="flex items-center justify-center gap-2 text-xs text-muted"><ShieldCheck className="h-4 w-4" /> Safe & secure payments</p>
    </div>
  );
}
