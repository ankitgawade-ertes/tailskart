"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, MapPin, Truck, CreditCard, Smartphone, Banknote, Plus, Lock, ChevronLeft, AlertCircle, Award } from "lucide-react";
import { useSite } from "@/components/SiteProvider";
import OrderSummary from "@/components/OrderSummary";
import { ProductVisual } from "@/components/ProductArt";
import { btn, input } from "@/components/ui";
import { ApiError, api, formatINR } from "@/lib/api";
import { useQuote } from "@/lib/useQuote";
import { useStore } from "@/lib/store";
import type { Address, Order } from "@/lib/types";

const STEPS = ["Address", "Delivery", "Payment"];
type NewAddress = Omit<Address, "id" | "isDefault">;
const EMPTY_ADDR: NewAddress = { name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "", label: "Home" };

type PaymentInfo = { provider: "razorpay"; keyId: string; razorpayOrderId: string; amount: number } | { provider: "mock"; amount: number } | null;

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: (r: unknown) => void) => void };
  }
}

function loadRazorpay() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, coupon, clearCart, setCoupon, user, ready, config } = useStore();
  const [step, setStep] = useState(0);
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [addrId, setAddrId] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<NewAddress>(EMPTY_ADDR);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [speed, setSpeed] = useState<"STANDARD" | "EXPRESS">("STANDARD");
  const [pay, setPay] = useState<"ONLINE" | "COD">("ONLINE");
  const [usePoints, setUsePoints] = useState(false);
  const site = useSite();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ order: Order; payment: PaymentInfo } | null>(null);
  const address = addresses?.find((a) => a.id === addrId);
  // Asking for the maximum lets the server apply its own cap (a share of the order, never more than the balance).
  const { quote, loading } = useQuote({ pincode: address?.pincode, speed, pointsToRedeem: usePoints ? 1_000_000 : 0 });

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/checkout");
  }, [ready, user, router]);

  useEffect(() => {
    if (!user) return;
    api<{ items: Address[] }>("/me/addresses")
      .then((r) => {
        setAddresses(r.items);
        setAddrId(r.items.find((a) => a.isDefault)?.id ?? r.items[0]?.id ?? "");
        if (!r.items.length) {
          setAdding(true);
          setForm((f) => ({ ...f, name: user.name ?? "", phone: user.phone }));
        }
      })
      .catch((e) => setError((e as Error).message));
  }, [user]);

  useEffect(() => {
    if (quote && !quote.cod.available && pay === "COD") setPay("ONLINE");
    if (quote && !quote.delivery.sameDay && speed === "EXPRESS") setSpeed("STANDARD");
  }, [quote, pay, speed]);

  const saveAddr = async () => {
    setErrors({});
    try {
      const a = await api<Address>("/me/addresses", { method: "POST", body: { ...form, line2: form.line2 || null } });
      setAddresses((prev) => [a, ...(prev ?? [])]);
      setAddrId(a.id);
      setAdding(false);
      setForm(EMPTY_ADDR);
    } catch (e) {
      if (e instanceof ApiError && e.details && typeof e.details === "object") {
        setErrors(Object.fromEntries(Object.entries(e.details as Record<string, string[]>).map(([k, v]) => [k, v[0]])));
      } else setErrors({ form: (e as Error).message });
    }
  };

  const finish = (order: Order) => {
    clearCart();
    setCoupon(null);
    router.push(`/order-success?id=${order.number}`);
  };

  const collectPayment = async (order: Order, payment: PaymentInfo) => {
    if (!payment) return finish(order);
    if (payment.provider === "mock") {
      const paid = await api<Order>("/payments/mock/confirm", { method: "POST", body: { orderNumber: order.number } });
      return finish(paid);
    }
    const ok = await loadRazorpay();
    if (!ok || !window.Razorpay) throw new Error("Couldn't load the payment window. Check your connection and try again.");
    await new Promise<void>((resolve, reject) => {
      const rzp = new window.Razorpay!({
        key: payment.keyId,
        amount: payment.amount,
        currency: "INR",
        name: "Tailskart",
        description: `Order ${order.number}`,
        order_id: payment.razorpayOrderId,
        prefill: { name: user?.name ?? "", contact: user ? `+91${user.phone}` : "", email: user?.email ?? "" },
        theme: { color: "#2438c8" },
        handler: async (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            const paid = await api<Order>("/payments/razorpay/verify", {
              method: "POST",
              body: { orderNumber: order.number, razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature },
            });
            finish(paid);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        modal: { ondismiss: () => reject(new Error("Payment was not completed. Your items are held for 30 minutes — try again or choose another method.")) },
      });
      rzp.on("payment.failed", () => reject(new Error("The payment failed. No money was taken — please try again.")));
      rzp.open();
    });
  };

  const placeOrder = async () => {
    setPlacing(true);
    setError("");
    try {
      if (pending) {
        await collectPayment(pending.order, pending.payment);
        return;
      }
      const r = await api<{ order: Order; payment: PaymentInfo }>("/orders", {
        method: "POST",
        body: { items: cart.map((c) => ({ variantId: c.variantId, qty: c.qty })), addressId: addrId, couponCode: coupon, speed, payment: pay, ...(usePoints && quote?.points?.redeemed ? { pointsToRedeem: quote.points.redeemed } : {}) },
      });
      if (r.payment) setPending(r);
      await collectPayment(r.order, r.payment);
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.code === "cart_changed") setStep(0);
    } finally {
      setPlacing(false);
    }
  };

  if (!ready || !user) return <div className="container-x py-20 text-center text-muted">Loading checkout…</div>;

  if (cart.length === 0 && !placing) {
    return (
      <div className="container-x py-20 text-center">
        <p className="font-display text-2xl text-brand">Your cart is empty</p>
        <Link href="/" className={`${btn.primary} mt-6`}>Continue shopping</Link>
      </div>
    );
  }

  const field = (k: keyof NewAddress, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      <input value={(form[k] as string) ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={`${input} ${errors[k] ? "border-red-400" : ""}`} {...props} />
      {errors[k] && <span className="mt-1 block text-xs text-red-600">{errors[k]}</span>}
    </label>
  );

  return (
    <div className="container-x py-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/cart" className="flex items-center gap-1 text-sm font-semibold text-brand"><ChevronLeft className="h-4 w-4" /> Back to cart</Link>
        <span className="flex items-center gap-1.5 text-xs text-muted"><Lock className="h-3.5 w-3.5" /> Secure checkout</span>
      </div>

      <ol className="mb-8 flex items-center justify-center gap-2 md:gap-4">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2 md:gap-4">
            <button onClick={() => i < step && !pending && setStep(i)} className={`flex items-center gap-2 text-sm font-bold ${i <= step ? "text-brand" : "text-muted"}`}>
              <span className={`grid h-8 w-8 place-items-center rounded-full ${i < step ? "bg-accent text-white" : i === step ? "bg-brand text-white" : "bg-sand"}`}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s}</span>
            </button>
            {i < STEPS.length - 1 && <span className={`h-0.5 w-8 rounded md:w-16 ${i < step ? "bg-accent" : "bg-line"}`} />}
          </li>
        ))}
      </ol>

      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {quote?.issues.map((i) => (
        <p key={i.variantId} className="mb-3 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-brand">{i.message} — your cart has been updated.</p>
      ))}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {step === 0 && (
            <section className="rounded-3xl bg-white p-5 shadow-soft md:p-7">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-brand"><MapPin className="h-5 w-5 text-brand" /> Delivery address</h2>
              {addresses === null ? (
                <p className="mt-4 text-sm text-muted">Loading your addresses…</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {addresses.map((a) => (
                    <label key={a.id} className={`flex cursor-pointer gap-3 rounded-2xl border-2 p-4 ${addrId === a.id ? "border-brand bg-accent-soft/40" : "border-line"}`}>
                      <input type="radio" name="addr" checked={addrId === a.id} onChange={() => setAddrId(a.id)} className="mt-1 accent-[#2438c8]" />
                      <span className="text-sm">
                        <span className="flex items-center gap-2 font-bold">{a.name} <span className="rounded bg-sand px-1.5 py-0.5 text-[10px] uppercase">{a.label}</span></span>
                        <span className="block text-ink/70">{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} – {a.pincode}</span>
                        <span className="block text-ink/70">Phone: {a.phone}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {adding ? (
                <div className="mt-5 rounded-2xl border border-line p-4">
                  <p className="mb-3 font-bold">Add a new address</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {field("name", "Full name", { autoComplete: "name" })}
                    {field("phone", "Mobile number", { inputMode: "numeric", maxLength: 10, autoComplete: "tel-national" })}
                    <div className="sm:col-span-2">{field("line1", "House no., building, street", { autoComplete: "address-line1" })}</div>
                    <div className="sm:col-span-2">{field("line2", "Area, landmark (optional)", { autoComplete: "address-line2" })}</div>
                    {field("pincode", "Pincode", { inputMode: "numeric", maxLength: 6, autoComplete: "postal-code" })}
                    {field("city", "City", { autoComplete: "address-level2" })}
                    {field("state", "State", { autoComplete: "address-level1" })}
                    <div>
                      <span className="mb-1 block text-xs font-semibold text-muted">Save as</span>
                      <div className="flex gap-2">
                        {(["Home", "Work", "Other"] as const).map((l) => (
                          <button key={l} onClick={() => setForm({ ...form, label: l })} className={`rounded-full border px-4 py-2 text-sm font-semibold ${form.label === l ? "border-brand bg-brand text-white" : "border-line"}`}>{l}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {errors.form && <p className="mt-3 text-sm text-red-600">{errors.form}</p>}
                  <div className="mt-4 flex gap-2">
                    <button onClick={saveAddr} className={btn.dark}>Save address</button>
                    {(addresses?.length ?? 0) > 0 && <button onClick={() => setAdding(false)} className={btn.ghost}>Cancel</button>}
                  </div>
                </div>
              ) : (
                <button onClick={() => setAdding(true)} className="mt-4 flex items-center gap-2 text-sm font-bold text-accent"><Plus className="h-4 w-4" /> Add new address</button>
              )}
              {quote && address && !quote.delivery.serviceable && <p className="mt-4 text-sm text-red-600">We don’t deliver to {address.pincode} yet.</p>}
              <button disabled={!addrId || adding || (quote ? !quote.delivery.serviceable : false)} onClick={() => setStep(1)} className={`${btn.primary} mt-6 w-full sm:w-auto`}>
                Deliver here
              </button>
            </section>
          )}

          {step === 1 && (
            <section className="rounded-3xl bg-white p-5 shadow-soft md:p-7">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-brand"><Truck className="h-5 w-5 text-brand" /> Delivery speed</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className={`cursor-pointer rounded-2xl border-2 p-4 ${speed === "STANDARD" ? "border-brand bg-accent-soft/40" : "border-line"}`}>
                  <input type="radio" name="speed" className="sr-only" checked={speed === "STANDARD"} onChange={() => setSpeed("STANDARD")} />
                  <span className="flex items-center justify-between font-bold">Standard <span className="text-accent">{quote && quote.shippingFee === 0 ? "FREE" : formatINR(config.shippingFee)}</span></span>
                  <span className="text-sm text-muted">{quote ? `Arrives in ${quote.delivery.etaDays[0] || 1}–${quote.delivery.etaDays[1]} days` : "Arrives in a few days"}</span>
                </label>
                <label className={`rounded-2xl border-2 p-4 ${quote?.delivery.sameDay ? "cursor-pointer" : "cursor-not-allowed opacity-50"} ${speed === "EXPRESS" ? "border-brand bg-accent-soft/40" : "border-line"}`}>
                  <input type="radio" name="speed" className="sr-only" disabled={!quote?.delivery.sameDay} checked={speed === "EXPRESS"} onChange={() => setSpeed("EXPRESS")} />
                  <span className="flex items-center justify-between font-bold">Same day <span className="text-accent">+ {formatINR(config.expressFee)}</span></span>
                  <span className="text-sm text-muted">{quote?.delivery.sameDay ? "Order before 2pm, arrives by 9pm" : "Not available for this pincode"}</span>
                </label>
              </div>
              <div className="mt-6">
                <p className="mb-3 text-sm font-bold">Items in this delivery</p>
                <ul className="space-y-2">
                  {cart.map((c) => (
                    <li key={c.variantId} className="flex items-center gap-3 text-sm">
                      <ProductVisual image={c.snap.image} kind={c.snap.kind} tint={c.snap.tint} brand={c.snap.brand} className="h-12 w-12 rounded-xl" />
                      <span className="flex-1">
                        <span className="line-clamp-1 font-semibold">{c.snap.name}</span>
                        <span className="text-xs text-muted">{c.snap.label} × {c.qty}</span>
                      </span>
                      <b>{formatINR(c.snap.price * c.qty)}</b>
                    </li>
                  ))}
                </ul>
              </div>
              <button onClick={() => setStep(2)} className={`${btn.primary} mt-6 w-full sm:w-auto`}>Continue to payment</button>
            </section>
          )}

          {step === 2 && (
            <section className="rounded-3xl bg-white p-5 shadow-soft md:p-7">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-brand"><CreditCard className="h-5 w-5 text-brand" /> Payment</h2>
              {config.payments.provider === "mock" && (
                <p className="mt-2 rounded-xl bg-brand-soft px-3 py-2 text-xs font-semibold text-brand">Test mode: online payments are simulated and no money is taken.</p>
              )}
              {site.loyalty?.enabled && !!quote?.points?.balance && !pending && (
                <label className={`mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 ${usePoints ? "border-brand bg-accent-soft/40" : "border-line"}`}>
                  <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} className="accent-[#2438c8]" />
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-cream"><Award className="h-5 w-5 text-brand" /></span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold">Use my Tailskart points</span>
                    <span className="text-xs text-muted">
                      {usePoints && quote.points.redeemed
                        ? `Using ${quote.points.redeemed} of ${quote.points.balance} points · you save ${formatINR(quote.points.discount)}`
                        : `You have ${quote.points.balance} points (1 point = ₹1, up to ${site.loyalty.maxRedeemPercent}% of this order)`}
                    </span>
                  </span>
                </label>
              )}
              <div className="mt-4 space-y-2">
                <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 ${pay === "ONLINE" ? "border-brand bg-accent-soft/40" : "border-line"}`}>
                  <input type="radio" name="pay" disabled={!!pending} checked={pay === "ONLINE"} onChange={() => setPay("ONLINE")} className="accent-[#2438c8]" />
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-cream"><Smartphone className="h-5 w-5 text-brand" /></span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold">Pay online</span>
                    <span className="text-xs text-muted">UPI, cards, net banking & wallets</span>
                  </span>
                </label>
                {config.cod.enabled && (
                  <label className={`flex items-center gap-3 rounded-2xl border-2 p-4 ${quote?.cod.available && !pending ? "cursor-pointer" : "cursor-not-allowed opacity-50"} ${pay === "COD" ? "border-brand bg-accent-soft/40" : "border-line"}`}>
                    <input type="radio" name="pay" disabled={!quote?.cod.available || !!pending} checked={pay === "COD"} onChange={() => setPay("COD")} className="accent-[#2438c8]" />
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-cream"><Banknote className="h-5 w-5 text-brand" /></span>
                    <span className="flex-1">
                      <span className="block text-sm font-bold">Cash on delivery</span>
                      <span className="text-xs text-muted">{quote?.cod.available ? "Pay when your order arrives" : quote?.cod.reason}</span>
                    </span>
                  </label>
                )}
              </div>
              <button onClick={placeOrder} disabled={placing || loading || !quote || quote.lines.length === 0} className={`${btn.primary} mt-6 w-full`}>
                {placing ? "Processing…" : pending ? `Retry payment · ${formatINR(pending.order.total)}` : quote ? `Place order · ${formatINR(quote.total)}` : "Place order"}
              </button>
              <p className="mt-3 text-center text-xs text-muted">
                By placing this order you agree to our <Link href="/policies/terms" className="underline">Terms</Link> and <Link href="/policies/returns" className="underline">Returns policy</Link>.
              </p>
            </section>
          )}
        </div>

        <div className="lg:sticky lg:top-36 lg:self-start">
          <OrderSummary quote={quote} loading={loading} />
        </div>
      </div>
    </div>
  );
}
