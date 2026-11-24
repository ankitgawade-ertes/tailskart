"use client";

import Link from "next/link";
import { useState } from "react";
import { Phone, Mail, MessageCircle, MapPin, Clock, CheckCircle2 } from "lucide-react";
import { Breadcrumbs, btn, input } from "@/components/ui";
import { useSite } from "@/components/SiteProvider";
import { api } from "@/lib/api";

export default function ContactPage() {
  const SITE = useSite();
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", topic: "Order help", message: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Contact us" }]} />
      <h1 className="font-display text-4xl font-semibold text-brand md:text-5xl">We’re here to help</h1>
      <p className="mt-2 max-w-xl text-ink/70">Reach us on WhatsApp for the fastest reply, or send a message and we’ll get back within a few hours.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-3">
          {[
            [MessageCircle, "WhatsApp", "Chat with us", SITE.whatsapp],
            [Phone, "Call", SITE.phone, SITE.phoneHref],
            [Mail, "Email", SITE.email, `mailto:${SITE.email}`],
          ].map(([Icon, t, v, href]) => {
            const I = Icon as typeof Phone;
            return (
              <a key={t as string} href={href as string} className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-soft transition hover:shadow-lift">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft"><I className="h-5 w-5 text-brand" /></span>
                <span><span className="block text-sm text-muted">{t as string}</span><span className="font-bold">{v as string}</span></span>
              </a>
            );
          })}
          <div className="rounded-3xl bg-white p-5 shadow-soft text-sm">
            <p className="flex items-center gap-2 font-bold"><Clock className="h-4 w-4 text-brand" /> {SITE.hours}</p>
            <p className="mt-3 flex gap-2 text-ink/70"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {SITE.address}</p>
          </div>
        </div>

        <div className="rounded-[32px] bg-white p-6 shadow-soft md:p-8 lg:col-span-2">
          {sent ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-accent" />
              <p className="mt-4 font-display text-2xl text-brand">Message received!</p>
              <p className="mt-1 text-muted">We’ll get back to you shortly.</p>
              <Link href="/" className={`${btn.ghost} mt-6`}>Back to home</Link>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!form.name || !form.message || (!form.email && !form.phone)) return setErr("Please add your name, a message and a phone or email.");
                setErr("");
                setBusy(true);
                try {
                  await api("/contact", { method: "POST", body: form });
                  setSent(true);
                } catch (e) {
                  setErr((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
              className="grid gap-4 sm:grid-cols-2"
            >
              <h2 className="font-display text-2xl font-semibold text-brand sm:col-span-2">Send us a message</h2>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className={input} />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className={input} inputMode="numeric" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" className={input} />
              <select value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className={input}>
                <option>Order help</option><option>Returns & refunds</option><option>Product question</option><option>Partnerships</option><option>Something else</option>
              </select>
              <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="How can we help?" rows={5} className={`${input} sm:col-span-2`} />
              {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
              <button disabled={busy} className={`${btn.primary} sm:col-span-2 sm:justify-self-start`}>{busy ? "Sending…" : "Send message"}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
