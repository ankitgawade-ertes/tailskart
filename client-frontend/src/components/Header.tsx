"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, MapPin, Heart, User, ShoppingBag, Menu, X, ChevronDown, ChevronRight, Truck, Phone, Stethoscope, Pill } from "lucide-react";
import { Logo, btn, input } from "./ui";
import { ProductVisual } from "./ProductArt";
import { PETS } from "@/data/pets";
import { PET_PHOTOS } from "@/data/images";
import { useSite } from "@/components/SiteProvider";
import { api, formatINR, qs } from "@/lib/api";
import type { Breed, Category, Pet, ProductList, Product } from "@/lib/types";
import { useStore } from "@/lib/store";

const MEGA: { pet: Pet; label: string; href: string }[] = [
  { pet: "dog", label: "Dogs", href: "/pets/dogs" },
  { pet: "cat", label: "Cats", href: "/pets/cats" },
  { pet: "small", label: "Small Pets", href: "/pets/small-pets" },
  { pet: "parent", label: "Pet Parents", href: "/pets/pet-parents" },
];

function groupsFor(categories: Category[], pet: Pet) {
  const map = new Map<string, Category[]>();
  categories.filter((c) => c.pet === pet).forEach((c) => map.set(c.group, [...(map.get(c.group) ?? []), c]));
  return Array.from(map.entries());
}

const firstName = (name: string | null | undefined) => (name ? name.split(" ")[0] : "Account");

export default function Header({ categories, breeds }: { categories: Category[]; breeds: Breed[] }) {
  const SITE = useSite();
  const ANNOUNCEMENTS = SITE.announcements;
  const { cartCount, wishlist, pincode, user, setCartOpen } = useStore();
  const [msg, setMsg] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const t = setInterval(() => setMsg((m) => (m + 1) % ANNOUNCEMENTS.length), 4000);
    return () => clearInterval(t);
  }, [ANNOUNCEMENTS.length]);
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <>
      <div className="bg-ink text-center text-xs font-medium text-white/90">
        <div className="w-full px-4 md:px-5 flex h-9 items-center justify-center md:justify-between">
          <span className="hidden items-center gap-1.5 md:flex">
            <Truck className="h-3.5 w-3.5" /> Same-day delivery in select cities
          </span>
          <span key={msg} className="animate-fade-up">{ANNOUNCEMENTS[msg]}</span>
          <a href={SITE.phoneHref} className="hidden items-center gap-1.5 hover:text-white md:flex">
            <Phone className="h-3.5 w-3.5" /> {SITE.phone}
          </a>
        </div>
      </div>

      <header className="sticky top-0 z-40 shadow-[0_8px_30px_-12px_rgb(24_33_55/0.25)]">
        {/* Glass: translucent ultramarine + blur, so the page shows softly through as you scroll. */}
        <div className="border-b border-white/15 bg-brand/75 backdrop-blur-xl backdrop-saturate-150">
        <div className="w-full px-4 md:px-5 flex h-16 items-center gap-3 md:h-[72px] md:gap-6">
          <button onClick={() => setMenuOpen(true)} className="-ml-1 grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 lg:hidden" aria-label="Open menu">
            <Menu className="h-6 w-6 text-white" />
          </button>
          <Link href="/" aria-label="Tailskart home" className="shrink-0">
            <Logo tone="white" className="text-[1.65rem] md:text-[2rem]" />
          </Link>

          <button onClick={() => setPinOpen(true)} className="hidden max-w-[190px] items-center gap-2 rounded-full px-3 py-2 text-left hover:bg-white/10 xl:flex">
            <MapPin className="h-5 w-5 shrink-0 text-white" />
            <span className="leading-tight">
              <span className="block text-[11px] text-white/70">Deliver to</span>
              <span className="flex items-center gap-1 text-sm font-bold text-white">
                {pincode ?? "Select pincode"} <ChevronDown className="h-3.5 w-3.5" />
              </span>
            </span>
          </button>

          <div className="hidden flex-1 md:block">
            <SearchBox />
          </div>

          <nav className="ml-auto flex items-center gap-0.5 md:gap-1">
            <button onClick={() => setPinOpen(true)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 xl:hidden" aria-label="Set delivery pincode">
              <MapPin className="h-5 w-5 text-white" />
            </button>
            <Link href="/wishlist" className="relative hidden h-10 w-10 place-items-center rounded-full hover:bg-white/10 sm:grid" aria-label="Wishlist">
              <Heart className="h-5 w-5 text-white" />
              {wishlist.length > 0 && <Dot n={wishlist.length} />}
            </Link>
            <Link href={user ? "/account" : "/login"} className="flex h-10 items-center gap-2 rounded-full px-2.5 hover:bg-white/10" aria-label="Account">
              <User className="h-5 w-5 text-white" />
              <span className="hidden text-sm font-semibold text-white lg:inline">{user ? firstName(user.name) : "Login"}</span>
            </Link>
            <button onClick={() => setCartOpen(true)} className="relative flex h-10 items-center gap-2 rounded-full bg-white px-3.5 text-brand hover:bg-fold-soft" aria-label="Cart">
              <ShoppingBag className="h-5 w-5" />
              <span className="hidden text-sm font-bold sm:inline">Cart</span>
              {cartCount > 0 && <Dot n={cartCount} />}
            </button>
          </nav>
        </div>

        <div className="w-full px-4 md:px-5 pb-3 md:hidden">
          <SearchBox />
        </div>
        </div>

        <div className="hidden border-b border-white/60 bg-white/65 backdrop-blur-xl backdrop-saturate-150 lg:block">
          <nav className="w-full px-4 md:px-5 relative flex h-12 items-center gap-1 text-sm font-semibold text-brand">
            {MEGA.map((m) => {
              const pet = PETS.find((p) => p.id === m.pet)!;
              return (
                <div key={m.pet} className="group">
                  <Link href={m.href} className="flex h-12 items-center gap-2 rounded-lg px-3 hover:text-accent">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={PET_PHOTOS[m.pet]} alt="" className="h-7 w-7 rounded-lg object-cover ring-2 ring-brand-soft transition group-hover:ring-brand/40" />
                    {m.label} <ChevronDown className="h-4 w-4 transition group-hover:rotate-180" />
                  </Link>
                  <div className="invisible absolute inset-x-4 top-full z-50 translate-y-1 pt-1 opacity-0 transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 md:inset-x-6">
                    <div className="flex gap-8 rounded-2xl border border-line bg-white p-6 shadow-lift">
                      {groupsFor(categories, m.pet).map(([group, cats]) => (
                        <div key={group} className="min-w-[160px]">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-brand">{group}</p>
                          <ul className="space-y-1.5">
                            {cats.map((c) => (
                              <li key={c.slug}>
                                <Link href={`/collections/${c.slug}`} className="font-medium text-ink/80 hover:text-accent">{c.name}</Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <Link href={m.href} className="relative ml-auto flex min-h-[200px] w-56 flex-col justify-end overflow-hidden rounded-xl p-5" style={{ background: pet.tint }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={PET_PHOTOS[m.pet]} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                        <span className="absolute inset-0 bg-gradient-to-t from-brand-deep/90 via-brand-deep/20 to-transparent" />
                        <span className="relative font-display text-lg font-bold text-white">Shop all {m.label}</span>
                        <span className="relative text-xs font-medium text-white/80">Explore everything →</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
            {breeds.length > 0 && (
              <div className="group">
                <Link href="/breeds" className="flex h-12 items-center gap-1 rounded-lg px-3 hover:text-accent">
                  Shop by Breed <ChevronDown className="h-4 w-4 transition group-hover:rotate-180" />
                </Link>
                <div className="invisible absolute inset-x-4 top-full z-50 translate-y-1 pt-1 opacity-0 transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 md:inset-x-6">
                  <div className="grid grid-cols-3 gap-1 rounded-2xl border border-line bg-white p-4 shadow-lift xl:grid-cols-5">
                    {breeds.map((b) => (
                      <Link key={b.slug} href={`/breeds/${b.slug}`} className="flex items-center gap-2 rounded-lg px-3 py-2 font-medium text-ink/80 hover:bg-cream hover:text-brand">
                        {b.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.imageUrl} alt="" loading="lazy" className="h-7 w-7 rounded-lg object-cover" />
                        ) : (
                          <span className="h-7 w-7 rounded-lg" style={{ background: b.tint }} />
                        )}
                        {b.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <Link href="/offers" className="flex h-12 items-center rounded-lg px-3 hover:text-accent">
              <span className="mr-1.5 rounded bg-sun px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink">Deals</span>Offers
            </Link>
            <Link href="/blog" className="flex h-12 items-center rounded-lg px-3 hover:text-accent">Pet Guides</Link>
            <span className="ml-auto flex items-center gap-1">
              <Link href="/ametad" className="flex h-12 items-center gap-1.5 rounded-lg px-3 text-ametad hover:underline">
                <Stethoscope className="h-4 w-4" /> Veterinary care
              </Link>
              <Link href="/pharko" className="flex h-12 items-center gap-1.5 rounded-lg px-3 text-pharko hover:underline">
                <Pill className="h-4 w-4" /> Pharmacy
              </Link>
            </span>
          </nav>
        </div>
      </header>

      {menuOpen && <MobileMenu categories={categories} onClose={() => setMenuOpen(false)} onPin={() => { setMenuOpen(false); setPinOpen(true); }} />}
      {pinOpen && <PincodeModal onClose={() => setPinOpen(false)} />}
    </>
  );
}

function Dot({ n }: { n: number }) {
  return (
    <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-sun px-1 text-[10px] font-bold text-ink ring-2 ring-brand">
      {n > 99 ? "99+" : n}
    </span>
  );
}

function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const popular = ["Dog food", "Cat litter", "Puppy", "Treats", "Harness", "Wet food"];

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api<ProductList>(`/products${qs({ q: term, limit: 5, facets: "false" })}`, { signal: ctrl.signal })
        .then((r) => setResults(r.items))
        .catch(() => {});
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const submit = (term: string) => {
    if (!term.trim()) return;
    setFocus(false);
    router.push(`/search?q=${encodeURIComponent(term.trim())}`);
  };

  return (
    <div className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(q);
        }}
        role="search"
        className="flex items-center rounded-full border border-line bg-white pl-4 transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15"
      >
        <Search className="h-[18px] w-[18px] shrink-0 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          placeholder="Search food, treats, toys, brands…"
          className="h-11 w-full bg-transparent px-3 text-sm outline-none placeholder:text-muted/80"
          aria-label="Search products"
        />
        <button type="submit" className="m-1 rounded-full bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand-deep">
          Search
        </button>
      </form>
      {focus && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-lift">
          {q.trim().length >= 2 && results.length > 0 ? (
            <ul>
              {results.map((p) => (
                <li key={p.id}>
                  <Link href={`/products/${p.slug}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-cream">
                    <ProductVisual image={p.images[0]?.url} kind={p.kind} tint={p.tint} brand={p.brand} className="h-11 w-11 shrink-0 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.name}</span>
                      <span className="text-xs text-muted">{p.brand}</span>
                    </span>
                    {p.variants[0] && <span className="text-sm font-bold">{formatINR(p.variants[0].price)}</span>}
                  </Link>
                </li>
              ))}
              <li>
                <button onMouseDown={() => submit(q)} className="w-full border-t border-line px-4 py-3 text-left text-sm font-semibold text-accent hover:bg-cream">
                  See all results for “{q}” →
                </button>
              </li>
            </ul>
          ) : (
            <div className="p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{q.trim().length >= 2 ? "No quick matches — try these" : "Popular searches"}</p>
              <div className="flex flex-wrap gap-2">
                {popular.map((t) => (
                  <button key={t} onMouseDown={() => submit(t)} className="rounded-full bg-cream px-3 py-1.5 text-sm font-medium hover:bg-accent-soft">
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MobileMenu({ categories, onClose, onPin }: { categories: Category[]; onClose: () => void; onPin: () => void }) {
  const [open, setOpen] = useState<Pet | null>("dog");
  const { pincode, user } = useStore();
  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <aside className="animate-fade-up absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-cream">
        <div className="flex items-center justify-between border-b border-line p-4">
          <Logo className="text-2xl" />
          <button onClick={onClose} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-full hover:bg-sand">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <Link href={user ? "/account" : "/login"} className="mb-3 flex items-center gap-3 rounded-2xl bg-brand p-4 text-white">
            <User className="h-6 w-6" />
            <span>
              <span className="block text-sm font-bold">{user ? `Hi, ${firstName(user.name)}` : "Login / Sign up"}</span>
              <span className="text-xs text-white/70">Orders, wishlist & addresses</span>
            </span>
          </Link>
          <button onClick={onPin} className="mb-4 flex w-full items-center gap-2 rounded-xl border border-line bg-white p-3 text-left text-sm">
            <MapPin className="h-5 w-5 text-brand" />
            Deliver to <b className="text-brand">{pincode ?? "Select pincode"}</b>
          </button>
          {MEGA.map((m) => (
            <div key={m.pet} className="border-b border-line/70">
              <button onClick={() => setOpen(open === m.pet ? null : m.pet)} className="flex w-full items-center justify-between py-3.5 font-semibold text-brand">
                <span className="flex items-center gap-2">
                  <span>{PETS.find((p) => p.id === m.pet)!.emoji}</span>
                  {m.label}
                </span>
                <ChevronDown className={`h-4 w-4 transition ${open === m.pet ? "rotate-180" : ""}`} />
              </button>
              {open === m.pet && (
                <ul className="mb-3 grid grid-cols-2 gap-2">
                  <li className="col-span-2">
                    <Link href={m.href} className="block rounded-lg bg-accent-soft px-3 py-2 text-sm font-semibold text-brand">Shop all {m.label} →</Link>
                  </li>
                  {categories
                    .filter((c) => c.pet === m.pet)
                    .map((c) => (
                      <li key={c.slug}>
                        <Link href={`/collections/${c.slug}`} className="block rounded-lg bg-white px-3 py-2 text-sm">{c.name}</Link>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ))}
          {[
            ["Shop by Breed", "/breeds"],
            ["Offers", "/offers"],
            ["Pet Guides", "/blog"],
            ["Veterinary care · ametad", "/ametad"],
            ["Pharmacy · pharko", "/pharko"],
            ["Refer a friend", "/refer"],
            ["Help & FAQs", "/faq"],
            ["Contact us", "/contact"],
          ].map(([l, h]) => (
            <Link key={h} href={h} className="flex items-center justify-between border-b border-line/70 py-3.5 font-semibold text-brand">
              {l} <ChevronRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}

export function PincodeModal({ onClose }: { onClose: () => void }) {
  const { pincode, setPincode } = useStore();
  const [val, setVal] = useState(pincode ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!/^[1-9][0-9]{5}$/.test(val)) {
      setErr("Please enter a valid 6-digit pincode");
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ serviceable: boolean }>(`/delivery/check?pincode=${val}`);
      if (!r.serviceable) {
        setErr("Sorry, we don't deliver to this pincode yet");
        return;
      }
      setPincode(val);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="animate-fade-up relative w-full rounded-t-3xl bg-white p-6 sm:max-w-md sm:rounded-3xl">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full hover:bg-sand">
          <X className="h-5 w-5" />
        </button>
        <div className="mb-1 grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft">
          <MapPin className="h-6 w-6 text-brand" />
        </div>
        <h3 className="mt-3 font-display text-2xl text-brand">Where should we deliver?</h3>
        <p className="mt-1 text-sm text-muted">Enter your pincode to see delivery dates and same-day availability.</p>
        <div className="mt-5 flex gap-2">
          <input
            value={val}
            onChange={(e) => {
              setVal(e.target.value.replace(/\D/g, "").slice(0, 6));
              setErr("");
            }}
            onKeyDown={(e) => e.key === "Enter" && save()}
            inputMode="numeric"
            placeholder="e.g. 560001"
            className={input}
            autoFocus
          />
          <button onClick={save} disabled={busy} className={btn.dark}>Apply</button>
        </div>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </div>
    </div>
  );
}
