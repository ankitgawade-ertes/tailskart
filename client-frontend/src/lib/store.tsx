"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "./api";
import type { Customer, Product, StoreConfig, Variant } from "./types";

/** A cart line. Display data is a snapshot; the server re-prices everything at checkout. */
export interface CartLine {
  variantId: string;
  productId: string;
  qty: number;
  snap: { slug: string; name: string; brand: string; label: string; price: number; mrp: number; kind: Product["kind"]; tint: string; image: string | null; stock: number };
}

const DEFAULT_CONFIG: StoreConfig = {
  freeShippingMin: 49900,
  shippingFee: 4900,
  expressFee: 4900,
  cod: { enabled: true, min: 29900, max: 500000 },
  payments: { provider: "mock", razorpayKeyId: null },
};

interface StoreState {
  ready: boolean;
  config: StoreConfig;
  cart: CartLine[];
  cartCount: number;
  subtotal: number;
  mrpTotal: number;
  addToCart: (product: Product, variant: Variant, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  removeFromCart: (variantId: string) => void;
  syncCart: (lines: { variantId: string; qty: number; price: number; mrp: number; stock: number }[]) => void;
  clearCart: () => void;
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  pincode: string | null;
  setPincode: (p: string | null) => void;
  user: Customer | null;
  setUser: (u: Customer | null) => void;
  logout: () => Promise<void>;
  coupon: string | null;
  setCoupon: (c: string | null) => void;
  toast: string | null;
  showToast: (msg: string) => void;
  cartOpen: boolean;
  setCartOpen: (o: boolean) => void;
}

const Ctx = createContext<StoreState | null>(null);

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [pincode, setPincodeState] = useState<string | null>(null);
  const [user, setUserState] = useState<Customer | null>(null);
  const [config, setConfig] = useState<StoreConfig>(DEFAULT_CONFIG);
  const [coupon, setCouponState] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = read<CartLine[]>("tk_cart_v2", []);
    setCart(Array.isArray(stored) ? stored.filter((l) => l && l.variantId && l.snap) : []);
    setPincodeState(read("tk_pin", null));
    setCouponState(read("tk_coupon", null));
    api<StoreConfig>("/config").then(setConfig).catch(() => {});
    api<{ customer: Customer | null }>("/auth/me")
      .then((r) => setUserState(r.customer))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) write("tk_cart_v2", cart);
  }, [cart, ready]);

  useEffect(() => {
    if (!user) {
      setWishlist([]);
      return;
    }
    api<{ ids: string[] }>("/me/wishlist")
      .then((r) => setWishlist(r.ids))
      .catch(() => {});
  }, [user]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  }, []);

  const addToCart = useCallback(
    (product: Product, v: Variant, qty = 1) => {
      if (!v.inStock) {
        showToast("This size is out of stock");
        return;
      }
      setCart((prev) => {
        const i = prev.findIndex((l) => l.variantId === v.id);
        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i], qty: Math.min(next[i].qty + qty, Math.min(10, v.stock)) };
          return next;
        }
        return [
          ...prev,
          {
            variantId: v.id,
            productId: product.id,
            qty: Math.min(qty, v.stock, 10),
            snap: {
              slug: product.slug,
              name: product.name,
              brand: product.brand,
              label: v.label,
              price: v.price,
              mrp: v.mrp,
              kind: product.kind,
              tint: product.tint,
              image: product.images[0]?.url ?? null,
              stock: v.stock,
            },
          },
        ];
      });
      setCartOpen(true);
    },
    [showToast],
  );

  const setQty = useCallback((variantId: string, qty: number) => {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((l) => l.variantId !== variantId)
        : prev.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(qty, 10, Math.max(l.snap.stock, 1)) } : l)),
    );
  }, []);

  const syncCart = useCallback((lines: { variantId: string; qty: number; price: number; mrp: number; stock: number }[]) => {
    setCart((prev) =>
      prev
        .map((l) => {
          const s = lines.find((x) => x.variantId === l.variantId);
          return s ? { ...l, qty: s.qty, snap: { ...l.snap, price: s.price, mrp: s.mrp, stock: s.stock } } : null;
        })
        .filter(Boolean) as CartLine[],
    );
  }, []);

  const toggleWishlist = useCallback(
    (productId: string) => {
      if (!user) {
        showToast("Log in to save favourites");
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      const has = wishlist.includes(productId);
      setWishlist((prev) => (has ? prev.filter((x) => x !== productId) : [...prev, productId]));
      showToast(has ? "Removed from wishlist" : "Saved to wishlist");
      api(`/me/wishlist/${productId}`, { method: has ? "DELETE" : "PUT" }).catch(() => {
        setWishlist((prev) => (has ? [...prev, productId] : prev.filter((x) => x !== productId)));
        showToast("Couldn't update your wishlist");
      });
    },
    [user, wishlist, router, pathname, showToast],
  );

  const value: StoreState = useMemo(
    () => ({
      ready,
      config,
      cart,
      cartCount: cart.reduce((s, c) => s + c.qty, 0),
      subtotal: cart.reduce((s, c) => s + c.qty * c.snap.price, 0),
      mrpTotal: cart.reduce((s, c) => s + c.qty * c.snap.mrp, 0),
      addToCart,
      setQty,
      removeFromCart: (id: string) => setCart((prev) => prev.filter((l) => l.variantId !== id)),
      syncCart,
      clearCart: () => setCart([]),
      wishlist,
      toggleWishlist,
      pincode,
      setPincode: (p: string | null) => {
        setPincodeState(p);
        write("tk_pin", p);
      },
      user,
      setUser: setUserState,
      logout: async () => {
        await api("/auth/logout", { method: "POST" }).catch(() => {});
        setUserState(null);
      },
      coupon,
      setCoupon: (c: string | null) => {
        setCouponState(c);
        write("tk_coupon", c);
      },
      toast,
      showToast,
      cartOpen,
      setCartOpen,
    }),
    [ready, config, cart, addToCart, setQty, syncCart, wishlist, toggleWishlist, pincode, user, coupon, toast, showToast, cartOpen],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
