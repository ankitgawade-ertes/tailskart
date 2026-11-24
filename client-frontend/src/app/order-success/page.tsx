"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Package, Share2 } from "lucide-react";
import { btn } from "@/components/ui";
import { api, formatINR } from "@/lib/api";
import type { Order } from "@/lib/types";

const PAY_LABEL: Record<Order["paymentMethod"], string> = { COD: "Cash on delivery", RAZORPAY: "Paid online", MOCK: "Paid (test mode)" };

function Success() {
  const id = useSearchParams().get("id") ?? "";
  const [order, setOrder] = useState<Order | null>(null);
  useEffect(() => {
    if (id) api<Order>(`/orders/${encodeURIComponent(id)}`).then(setOrder).catch(() => {});
  }, [id]);
  const eta = new Date(Date.now() + (order?.shippingSpeed === "EXPRESS" ? 0 : 2) * 864e5).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="container-x py-10 md:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-[32px] bg-white p-8 text-center shadow-soft md:p-12">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-accent-soft">
            <CheckCircle2 className="h-11 w-11 text-accent" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-semibold text-brand md:text-4xl">Order placed! 🐾</h1>
          <p className="mt-2 text-muted">Thank you for shopping with Tailskart. You can track your order any time from your account.</p>
          <div className="mt-6 grid gap-3 rounded-2xl bg-cream p-5 text-left text-sm sm:grid-cols-3">
            <div><p className="text-xs text-muted">Order ID</p><p className="font-bold">#{id}</p></div>
            <div><p className="text-xs text-muted">Expected by</p><p className="font-bold">{eta}</p></div>
            <div>
              <p className="text-xs text-muted">Amount</p>
              <p className="font-bold">
                {order ? formatINR(order.total) : "—"}
                {order && <span className="block text-xs font-normal text-muted">{PAY_LABEL[order.paymentMethod]}</span>}
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={`/account/orders/${id}`} className={btn.dark}><Package className="h-4 w-4" /> Track order</Link>
            <Link href="/" className={btn.ghost}>Continue shopping</Link>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-4 rounded-3xl bg-brand-soft p-6">
          <span className="text-4xl">🐶</span>
          <div className="flex-1">
            <p className="font-bold text-brand">Know a fellow pet parent?</p>
            <p className="text-sm text-ink/70">Share Tailskart with friends who’d love fast pet deliveries.</p>
          </div>
          <Link href="/refer" className="flex items-center gap-1 text-sm font-bold text-brand"><Share2 className="h-4 w-4" /> Share</Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={null}>
      <Success />
    </Suspense>
  );
}
