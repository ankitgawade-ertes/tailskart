import type { Pet } from "@/lib/types";

/** The four top-level store sections. Categories inside them are managed in the admin panel. */
export const PETS: { id: Pet; name: string; slug: string; tagline: string; tint: string; emoji: string }[] = [
  { id: "dog", name: "Dogs", slug: "dogs", tagline: "Food, treats, toys and everything for your good boy or girl.", tint: "#e3e9fc", emoji: "🐕" },
  { id: "cat", name: "Cats", slug: "cats", tagline: "Picky-eater approved meals, litter and cosy corners.", tint: "#dff0fd", emoji: "🐈" },
  { id: "small", name: "Small Pets", slug: "small-pets", tagline: "For fish, birds, rabbits and hamsters.", tint: "#fff3cc", emoji: "🐠" },
  { id: "parent", name: "Pet Parents", slug: "pet-parents", tagline: "Cleaning, gifting and merch for the humans.", tint: "#ece8fb", emoji: "🧡" },
];

export const petById = (id: Pet) => PETS.find((p) => p.id === id)!;
export const petBySlug = (slug: string) => PETS.find((p) => p.slug === slug);

export const categoryTitle = (c: { name: string; pet: Pet }) =>
  c.pet === "dog" ? `Dog ${c.name}` : c.pet === "cat" ? `Cat ${c.name}` : c.name;

/** Price bands for "Shop by price" (values in paise, as the API's price filter expects). */
export const PRICE_TILES = [
  { value: "0-29900", label: "Under ₹299", short: "₹299", note: "Treats, toys & small packs" },
  { value: "30000-69900", label: "₹300 – ₹699", short: "₹699", note: "Everyday essentials" },
  { value: "70000-149900", label: "₹700 – ₹1,499", short: "₹1,499", note: "Food bags & beds" },
  { value: "150000-100000000", label: "₹1,500 & above", short: "₹1,500+", note: "Big packs & premium picks" },
] as const;

export const PRICE_LABELS: Record<string, string> = Object.fromEntries(PRICE_TILES.map((t) => [t.value, t.label]));
