"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Home, LayoutGrid, Tag, User, ShoppingBag, Instagram, Facebook, Youtube, Mail, Phone, MapPin, ShieldCheck, Truck, RotateCcw, BadgeCheck, MessageCircle, Gift, ArrowRight } from "lucide-react";
import { Logo, input } from "./ui";
import { categoryTitle } from "@/data/pets";
import { api } from "@/lib/api";
import type { Category } from "@/lib/types";
import { useSite } from "@/components/SiteProvider";
import { useStore } from "@/lib/store";

const COLS: { title: string; links: [string, string][] }[] = [
  {
    title: "Shop",
    links: [
      ["Dogs", "/pets/dogs"],
      ["Cats", "/pets/cats"],
      ["Small Pets", "/pets/small-pets"],
      ["Pet Parents", "/pets/pet-parents"],
      ["Shop by Breed", "/breeds"],
      ["Offers", "/offers"],
    ],
  },
  {
    title: "Tailskart",
    links: [
      ["Our story", "/about"],
      ["Pet Guides", "/blog"],
      ["Refer a friend", "/refer"],
      ["Contact us", "/contact"],
      ["FAQs", "/faq"],
    ],
  },
  {
    title: "Help",
    links: [
      ["My account", "/account"],
      ["Track order", "/account/orders"],
      ["Shipping policy", "/policies/shipping"],
      ["Returns & refunds", "/policies/returns"],
      ["Privacy policy", "/policies/privacy"],
      ["Terms of use", "/policies/terms"],
    ],
  },
];

export default function Footer({ categories }: { categories: Category[] }) {
  const SITE = useSite();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  return (
    <>
    <section className="container-x mt-20 grid gap-4 md:grid-cols-2 md:gap-6" aria-label="Help and rewards">
      <a href={SITE.whatsapp} target="_blank" rel="noreferrer" className="group flex items-center gap-5 rounded-3xl bg-white p-6 transition hover:shadow-lift md:p-7">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand text-white"><MessageCircle className="h-7 w-7" /></span>
        <span className="flex-1">
          <span className="block font-display text-xl font-bold text-ink">Not sure what to pick?</span>
          <span className="text-sm text-muted">Message our team on WhatsApp — we’ll help you choose the right food, size or toy.</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-brand transition group-hover:translate-x-1" />
      </a>
      <Link href="/refer" className="group flex items-center gap-5 rounded-3xl bg-sun p-6 transition hover:shadow-lift md:p-7">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-brand"><Gift className="h-7 w-7" /></span>
        <span className="flex-1">
          <span className="block font-display text-xl font-bold text-ink">Refer a friend</span>
          <span className="text-sm text-ink/75">Share Tailskart with another pet parent and you both earn points when their first order arrives.</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-ink transition group-hover:translate-x-1" />
      </Link>
    </section>
    <footer className="mt-10 bg-ink text-white/80">
      <div className="fold-band">
        <div className="container-x flex flex-col items-start justify-between gap-2 py-6 pr-16 sm:flex-row sm:items-center">
          <Logo tone="white" className="text-3xl" />
          <p className="text-lg font-semibold text-white">Their everyday, delivered.</p>
        </div>
      </div>
      <div className="border-b border-white/10">
        <div className="container-x grid grid-cols-2 gap-6 py-8 md:grid-cols-4">
          {[
            [Truck, "Fast delivery", "Same-day in select cities"],
            [BadgeCheck, "100% genuine", "Sourced from brands"],
            [RotateCcw, "Easy returns", "7-day hassle-free"],
            [ShieldCheck, "Secure payments", "UPI, cards & COD"],
          ].map(([Icon, t, s]) => {
            const I = Icon as typeof Truck;
            return (
              <div key={t as string} className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10">
                  <I className="h-5 w-5 text-fold" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-white">{t as string}</span>
                  <span className="text-xs text-white/60">{s as string}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="container-x grid gap-10 py-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">{SITE.tagline} Food, treats, toys and care for dogs, cats and small pets.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setErr("");
              try {
                await api("/newsletter", { method: "POST", body: { email } });
                setDone(true);
              } catch (e) {
                setErr((e as Error).message);
              }
            }}
            className="mt-6 max-w-sm"
          >
            <p className="mb-2 text-sm font-bold text-white">Get pet tips & member-only offers</p>
            {done ? (
              <p className="rounded-xl bg-white/10 px-4 py-3 text-sm text-fold">Thanks! You’re on the list 🐾</p>
            ) : (
              <div className="flex gap-2">
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Your email" className={`${input} border-white/15 bg-white/10 text-white placeholder:text-white/50`} />
                <button className="rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-[#1a2a9c]">Join</button>
              </div>
            )}
            {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
          </form>
        </div>

        {COLS.map((c) => (
          <div key={c.title} className="md:col-span-2">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-fold">{c.title}</p>
            <ul className="space-y-2 text-sm">
              {c.links.map(([l, h]) => (
                <li key={h}>
                  <Link href={h} className="hover:text-white">{l}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="md:col-span-2">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-fold">Get in touch</p>
          <ul className="space-y-2.5 text-sm">
            <li><a href={SITE.phoneHref} className="flex items-center gap-2 hover:text-white"><Phone className="h-4 w-4" />{SITE.phone}</a></li>
            <li><a href={`mailto:${SITE.email}`} className="flex items-center gap-2 hover:text-white"><Mail className="h-4 w-4" />{SITE.email}</a></li>
            <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span className="text-white/60">{SITE.address}</span></li>
          </ul>
          <div className="mt-4 flex gap-2">
            {[
              [Instagram, SITE.social.instagram, "Instagram"],
              [Facebook, SITE.social.facebook, "Facebook"],
              [Youtube, SITE.social.youtube, "YouTube"],
            ].map(([Icon, href, label]) => {
              const I = Icon as typeof Instagram;
              return (
                <a key={label as string} href={href as string} aria-label={label as string} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 hover:bg-brand">
                  <I className="h-4 w-4" />
                </a>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-x py-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-white/50">Popular categories</p>
          <p className="text-xs leading-6 text-white/50">
            {categories.map((c, i) => (
              <span key={c.slug}>
                <Link href={`/collections/${c.slug}`} className="hover:text-white">
                  {categoryTitle(c)}
                </Link>
                {i < categories.length - 1 && <span className="mx-2">·</span>}
              </span>
            ))}
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 pb-20 md:pb-0">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-white/50 md:flex-row">
          <span>© {new Date().getFullYear()} Tailskart. All rights reserved.</span>
          <span>UPI · Visa · Mastercard · RuPay · Net Banking · COD</span>
        </div>
      </div>
    </footer>
    </>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const { cartCount, setCartOpen, user } = useStore();
  const items = [
    { href: "/", label: "Home", Icon: Home },
    { href: "/categories", label: "Categories", Icon: LayoutGrid },
    { href: "/offers", label: "Offers", Icon: Tag },
    { href: user ? "/account" : "/login", label: "Account", Icon: User },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur md:hidden">
      <div className="grid grid-cols-5">
        {items.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={label} href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active ? "text-brand" : "text-muted"}`}>
              <Icon className={`h-5 w-5 ${active ? "text-accent" : ""}`} />
              {label}
            </Link>
          );
        })}
        <button onClick={() => setCartOpen(true)} className="relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-muted">
          <ShoppingBag className="h-5 w-5" />
          Cart
          {cartCount > 0 && (
            <span className="absolute right-[22%] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">{cartCount}</span>
          )}
        </button>
      </div>
    </nav>
  );
}
