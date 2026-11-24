"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useStore } from "./store";
import type { Quote } from "./types";

/**
 * Asks the API to price the current cart (prices, stock, coupon, delivery, COD).
 * The browser cart is corrected if the server reports changed prices or stock.
 */
export function useQuote(opts: { pincode?: string | null; speed?: "STANDARD" | "EXPRESS"; pointsToRedeem?: number } = {}) {
  const { cart, coupon, syncCart, setCoupon } = useStore();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const key = useMemo(
    () => JSON.stringify([cart.map((c) => [c.variantId, c.qty]), coupon, opts.pincode, opts.speed, opts.pointsToRedeem]),
    [cart, coupon, opts.pincode, opts.speed, opts.pointsToRedeem],
  );

  useEffect(() => {
    if (!cart.length) {
      setQuote(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    api<Quote>("/cart/quote", {
      method: "POST",
      body: { items: cart.map((c) => ({ variantId: c.variantId, qty: c.qty })), couponCode: coupon, pincode: opts.pincode || null, speed: opts.speed, ...(opts.pointsToRedeem ? { pointsToRedeem: opts.pointsToRedeem } : {}) },
      signal: ctrl.signal,
    })
      .then((q) => {
        setQuote(q);
        const changed =
          q.lines.length !== cart.length ||
          q.lines.some((l) => {
            const c = cart.find((x) => x.variantId === l.variantId);
            return !c || c.qty !== l.qty || c.snap.price !== l.price || c.snap.mrp !== l.mrp || c.snap.stock !== l.stock;
          });
        if (changed) syncCart(q.lines);
        if (coupon && q.couponError) setCoupon(null);
      })
      .catch((e) => (e as Error).name !== "AbortError" && setError((e as Error).message))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { quote, loading, error };
}
