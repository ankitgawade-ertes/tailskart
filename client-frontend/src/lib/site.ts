// Store details (contact, social, announcements, delivery thresholds) come from Admin → Settings.
// The hard-coded values in data/content.ts are the fallback when the API can't be reached.
import { ANNOUNCEMENTS, SITE } from "@/data/content";
import { serverGetSafe } from "./api";

export interface PublicSettings {
  store: { name: string; tagline: string; phone: string; whatsapp: string; email: string; address: string; hours: string; legalName: string; gstin: string };
  social: { instagram: string; facebook: string; youtube: string; x: string };
  announcements: string[];
  shipping: { freeShippingMin: number; shippingFee: number; expressFee: number };
  cod: { enabled: boolean; min: number; max: number };
  branches: string[];
  loyalty: { enabled: boolean; pointsPer100: number; maxRedeemPercent: number };
}

export type Site = typeof SITE & { announcements: string[]; loyalty: PublicSettings["loyalty"] | null };

const digits = (s: string) => s.replace(/\D/g, "");
const telHref = (phone: string) => {
  const d = digits(phone);
  return `tel:+${d.length === 10 ? `91${d}` : d}`;
};
const waLink = (n: string) => {
  if (/^https?:\/\//.test(n)) return n;
  const d = digits(n);
  return d ? `https://wa.me/${d.length === 10 ? `91${d}` : d}` : SITE.whatsapp;
};

export const DEFAULT_SITE: Site = { ...SITE, announcements: ANNOUNCEMENTS, loyalty: null };

export function siteFrom(s: PublicSettings | null): Site {
  if (!s) return DEFAULT_SITE;
  const freeShippingAbove = Math.round(s.shipping.freeShippingMin / 100);
  return {
    ...SITE,
    name: s.store.name || SITE.name,
    tagline: s.store.tagline || SITE.tagline,
    phone: s.store.phone || SITE.phone,
    phoneHref: s.store.phone ? telHref(s.store.phone) : SITE.phoneHref,
    whatsapp: s.store.whatsapp ? waLink(s.store.whatsapp) : SITE.whatsapp,
    email: s.store.email || SITE.email,
    address: s.store.address || SITE.address,
    hours: s.store.hours || SITE.hours,
    social: {
      instagram: s.social.instagram || SITE.social.instagram,
      facebook: s.social.facebook || SITE.social.facebook,
      youtube: s.social.youtube || SITE.social.youtube,
      x: s.social.x || SITE.social.x,
    },
    freeShippingAbove,
    codRange: [Math.round(s.cod.min / 100), Math.round(s.cod.max / 100)],
    announcements: s.announcements.length
      ? s.announcements
      : [`Free delivery on orders above ₹${freeShippingAbove}`, ...ANNOUNCEMENTS.slice(1)],
    loyalty: s.loyalty,
  };
}

/** For server components. Cached briefly like other API reads. */
export async function getSite(): Promise<Site> {
  return siteFrom(await serverGetSafe<PublicSettings | null>("/settings", null, 60));
}
