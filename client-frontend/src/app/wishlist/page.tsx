"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { Breadcrumbs, btn } from "@/components/ui";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useStore } from "@/lib/store";

export default function WishlistPage() {
  const { user, ready, wishlist } = useStore();
  const [items, setItems] = useState<Product[] | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ items: Product[] }>("/me/wishlist")
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, [user]);

  const visible = items?.filter((p) => wishlist.includes(p.id)) ?? [];

  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Wishlist" }]} />
      <h1 className="font-display text-3xl font-semibold text-brand md:text-4xl">Your wishlist</h1>
      {!ready || (user && items === null) ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : !user ? (
        <div className="mt-6 rounded-3xl bg-white p-12 text-center shadow-soft">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand-soft"><Heart className="h-9 w-9 text-brand" /></div>
          <p className="mt-4 font-display text-2xl text-brand">Log in to see your wishlist</p>
          <Link href="/login?next=/wishlist" className={`${btn.primary} mt-6`}>Log in / Sign up</Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-6 rounded-3xl bg-white p-12 text-center shadow-soft">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand-soft"><Heart className="h-9 w-9 text-brand" /></div>
          <p className="mt-4 font-display text-2xl text-brand">Nothing saved yet</p>
          <p className="mt-1 text-sm text-muted">Tap the heart on any product to save it for later.</p>
          <Link href="/offers" className={`${btn.primary} mt-6`}>Browse deals</Link>
        </div>
      ) : (
        <>
          <p className="mb-6 mt-1 text-sm text-muted">{visible.length} saved item(s)</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
