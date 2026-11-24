"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, MapPin, CreditCard, MessageCircle, RotateCcw, Printer, XCircle } from "lucide-react";
import { ProductVisual } from "@/components/ProductArt";
import { btn } from "@/components/ui";
import { api, formatINR } from "@/lib/api";
import { useSite } from "@/components/SiteProvider";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/orderStatus";
import type { Order, OrderStatus } from "@/lib/types";

const FLOW: OrderStatus[] = ["PLACED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
const PAY: Record<Order["paymentMethod"], string> = { COD: "Cash on delivery", RAZORPAY: "Online payment", MOCK: "Online payment (test mode)" };

export default function OrderDetailPage() {
  const SITE = useSite();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<Order>(`/orders/${encodeURIComponent(id)}`)
      .then(setOrder)
      .catch(() => setOrder(null));
  }, [id]);

  if (order === undefined) return <p className="text-sm text-muted">Loading…</p>;
  if (order === null)
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-soft">
        <p className="font-display text-xl text-brand">Order not found</p>
        <Link href="/account/orders" className={`${btn.dark} mt-4`}>Back to orders</Link>
      </div>
    );

  const stage = FLOW.indexOf(order.status);
  const eventDate = (s: OrderStatus) => order.events?.find((e) => e.status === s)?.createdAt;
  const cancellable = ["PENDING_PAYMENT", "PLACED", "PACKED"].includes(order.status);

  const cancel = async () => {
    if (!window.confirm("Cancel this order? Any reserved items will be released.")) return;
    setBusy(true);
    setErr("");
    try {
      setOrder(await api<Order>(`/orders/${order.number}/cancel`, { method: "POST" }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link href="/account/orders" className="flex items-center gap-1 text-sm font-semibold text-brand print:hidden"><ChevronLeft className="h-4 w-4" /> All orders</Link>
      <section className="rounded-3xl bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-brand">Order #{order.number}</h1>
            <p className="text-sm text-muted">Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[order.status]}`}>{STATUS_LABEL[order.status]}</span>
        </div>

        {stage >= 0 && (
          <ol className="mt-8 grid grid-cols-5">
            {FLOW.map((s, i) => {
              const d = eventDate(s);
              return (
                <li key={s} className="relative flex flex-col items-center text-center">
                  {i > 0 && <span className={`absolute right-1/2 top-4 h-1 w-full -translate-y-1/2 ${i <= stage ? "bg-accent" : "bg-line"}`} />}
                  <span className={`relative z-10 grid h-8 w-8 place-items-center rounded-full ${i <= stage ? "bg-accent text-white" : "bg-sand text-muted"}`}>
                    {i <= stage ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className={`mt-2 text-[11px] font-semibold leading-tight md:text-xs ${i <= stage ? "text-brand" : "text-muted"}`}>{STATUS_LABEL[s]}</span>
                  {d && <span className="text-[10px] text-muted">{new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                </li>
              );
            })}
          </ol>
        )}
        {order.status === "PENDING_PAYMENT" && <p className="mt-4 rounded-xl bg-sand px-4 py-3 text-sm">We haven’t received payment for this order yet. Unpaid orders are cancelled automatically after 30 minutes.</p>}
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-soft">
        <h2 className="mb-4 font-bold text-brand">Items</h2>
        <ul className="divide-y divide-line">
          {order.items.map((it) => (
            <li key={it.id} className="flex items-center gap-4 py-3">
              <ProductVisual image={it.image} kind={it.kind} tint={it.tint} brand={it.brand} className="h-16 w-16 rounded-xl" />
              <div className="min-w-0 flex-1">
                <Link href={`/products/${it.slug}`} className="line-clamp-1 font-semibold hover:text-brand">{it.name}</Link>
                <p className="text-xs text-muted">{it.brand} · {it.variantLabel} × {it.qty}</p>
                <Link href={`/products/${it.slug}`} className="mt-1 inline-block text-xs font-bold text-accent print:hidden">Buy again</Link>
              </div>
              <b>{formatINR(it.price * it.qty)}</b>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-3xl bg-white p-6 shadow-soft">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-brand"><MapPin className="h-4 w-4" /> Delivery address</h2>
          <p className="text-sm font-semibold">{order.address.name}</p>
          <p className="text-sm text-ink/70">{order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ""}</p>
          <p className="text-sm text-ink/70">{order.address.city}, {order.address.state} – {order.address.pincode}</p>
          <p className="text-sm text-ink/70">Phone: {order.address.phone}</p>
        </section>
        <section className="rounded-3xl bg-white p-6 shadow-soft">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-brand"><CreditCard className="h-4 w-4" /> Payment</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatINR(order.subtotal)}</dd></div>
            {order.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Coupon {order.couponCode}</dt><dd className="text-accent">−{formatINR(order.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{order.shippingFee ? formatINR(order.shippingFee) : "FREE"}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 font-extrabold"><dt>Total</dt><dd>{formatINR(order.total)}</dd></div>
            <p className="pt-1 text-xs text-muted">{PAY[order.paymentMethod]} · {order.paymentStatus.toLowerCase()}</p>
          </dl>
        </section>
      </div>

      {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
      <section className="flex flex-wrap gap-3 print:hidden">
        <a href={SITE.whatsapp} target="_blank" rel="noreferrer" className={btn.ghost}><MessageCircle className="h-4 w-4" /> Need help?</a>
        {cancellable && (
          <button onClick={cancel} disabled={busy} className={`${btn.ghost} !text-red-600`}><XCircle className="h-4 w-4" /> Cancel order</button>
        )}
        {order.status === "DELIVERED" && <Link href="/policies/returns" className={btn.ghost}><RotateCcw className="h-4 w-4" /> Return item</Link>}
        <button onClick={() => window.print()} className={btn.ghost}><Printer className="h-4 w-4" /> Print</button>
      </section>
    </div>
  );
}
