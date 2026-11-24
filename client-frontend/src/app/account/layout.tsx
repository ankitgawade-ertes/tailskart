"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User, Package, MapPin, Heart, Gift, LogOut, HelpCircle } from "lucide-react";
import { Breadcrumbs, btn } from "@/components/ui";
import { useStore } from "@/lib/store";

const NAV = [
  { href: "/account", label: "Profile & pets", Icon: User },
  { href: "/account/orders", label: "My orders", Icon: Package },
  { href: "/account/addresses", label: "Addresses", Icon: MapPin },
  { href: "/wishlist", label: "Wishlist", Icon: Heart },
  { href: "/refer", label: "Refer a friend", Icon: Gift },
  { href: "/faq", label: "Help", Icon: HelpCircle },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, ready } = useStore();

  if (!ready) return <div className="container-x py-20 text-center text-muted">Loading…</div>;

  if (!user) {
    return (
      <div className="container-x py-16">
        <div className="mx-auto max-w-md rounded-[32px] bg-white p-10 text-center shadow-soft">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent-soft"><User className="h-8 w-8 text-brand" /></div>
          <h1 className="mt-4 font-display text-2xl font-semibold text-brand">Log in to see your account</h1>
          <p className="mt-1 text-sm text-muted">Track orders, manage addresses and save your favourites.</p>
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={`${btn.primary} mt-6 w-full`}>Log in / Sign up</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "My account" }]} />
      <div className="grid gap-6 lg:grid-cols-4">
        <aside className="lg:sticky lg:top-36 lg:self-start">
          <div className="rounded-3xl bg-brand p-5 text-white">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-white/15 font-display text-xl">{(user.name ?? "P")[0].toUpperCase()}</div>
            <p className="mt-3 font-bold">{user.name ?? "Pet parent"}</p>
            <p className="text-sm text-white/70">+91 {user.phone}</p>
          </div>
          <nav className="no-scrollbar mt-3 flex gap-2 overflow-x-auto lg:flex-col lg:gap-0 lg:rounded-3xl lg:bg-white lg:p-2 lg:shadow-soft">
            {NAV.map(({ href, label, Icon }) => {
              const active = href === "/account" ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold lg:rounded-2xl ${active ? "bg-accent-soft text-brand" : "bg-white text-ink/80 hover:bg-cream lg:bg-transparent"}`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </Link>
              );
            })}
            <button
              onClick={async () => {
                await logout();
                router.push("/");
              }}
              className="flex shrink-0 items-center gap-3 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 lg:rounded-2xl lg:bg-transparent"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </nav>
        </aside>
        <div className="lg:col-span-3">{children}</div>
      </div>
    </div>
  );
}
