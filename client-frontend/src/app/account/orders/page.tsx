"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Package } from "lucide-react";
import { ProductVisual } from "@/components/ProductArt";
import { btn } from "@/components/ui";
import { api, formatINR } from "@/lib/api";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/orderStatus";
import type { Order } from "@/lib/types";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<{ items: Order[] }>("/orders")
      .then((r) => setOrders(r.items))
      .catch((e) => setErr((e as Error).message));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold text-brand">My orders</h1>
      {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
      {orders === null && !err && <p className="text-sm text-muted">Loading…</p>}
      {orders?.length === 0 && (
        <div className="rounded-3xl bg-white p-10 text-center shadow-soft">
          <Package className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 font-display text-xl text-brand">No orders yet</p>
          <Link href="/" className={`${btn.primary} mt-5`}>Start shopping</Link>
        </div>
      )}
      {orders?.map((o) => (
        <Link key={o.id} href={`/account/orders/${o.number}`} className="block rounded-3xl bg-white p-5 shadow-soft transition hover:shadow-lift">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold">Order #{o.number}</p>
              <p className="text-xs text-muted">
                {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · {o.items.length} item(s)
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            {o.items.slice(0, 4).map((it) => (
              <ProductVisual key={it.id} image={it.image} kind={it.kind} tint={it.tint} brand={it.brand} className="h-14 w-14 rounded-xl" />
            ))}
            <span className="ml-auto flex items-center gap-1 text-sm font-bold">
              {formatINR(o.total)} <ChevronRight className="h-4 w-4 text-muted" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
