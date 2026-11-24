/**
 * Dummy photography (Unsplash, free licence, hot-linked).
 * Replace with your own rights-cleared photos before launch — brand book p.15:
 * natural light, real tasks, identifiable manufacturer packs in commerce imagery.
 * Product, category and breed photos live in the database and are managed in the admin panel.
 */

export const unsplash = (id: string, w = 900, h = w) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=70`;

export const PET_PHOTOS = {
  dog: unsplash("1586671267731-da2cf3ceeb80", 600, 500),
  cat: unsplash("1573865526739-10659fec78a5", 600, 500),
  small: unsplash("1585110396000-c9ffd4e4b308", 600, 500),
  parent: unsplash("1526363269865-60998e11d82d", 600, 500),
} as const;

export const HERO_PHOTOS = [
  unsplash("1601758003122-53c40e686a19", 900, 760), // pet parent at home with dog
  unsplash("1541188495357-ad2dc89487f4", 900, 760), // cat asleep on pet bed
  unsplash("1585110396000-c9ffd4e4b308", 900, 760), // rabbit
];

/** Wide crops of the hero photos for the full-width homepage banner. */
export const HERO_WIDE = [
  unsplash("1601758003122-53c40e686a19", 1800, 760),
  unsplash("1541188495357-ad2dc89487f4", 1800, 760),
  unsplash("1585110396000-c9ffd4e4b308", 1800, 760),
];

/** Tall photos for the "For dogs / For cats" split on the homepage. */
export const SPLIT_PHOTOS = {
  dog: unsplash("1586671267731-da2cf3ceeb80", 900, 1000),
  cat: unsplash("1573865526739-10659fec78a5", 900, 1000),
} as const;

export const CARE_PHOTOS = {
  ametad: unsplash("1770836037275-38b44e4b101f", 1200, 700), // veterinarian with a dog
  pharko: unsplash("1580281657527-47f249e8f4df", 1200, 700), // pharmacist at the shelves
};

export const BLOG_PHOTOS: Record<string, string> = {
  "first-week-with-a-new-puppy": unsplash("1561037404-61cd46aa615b", 1200, 675),
  "how-to-choose-cat-litter": unsplash("1727510153658-643787acb16a", 1200, 675),
  "winter-care-for-dogs": unsplash("1699686160376-940e512f65f8", 1200, 675),
  "reading-pet-food-labels": unsplash("1695023265600-07f536e8ca4c", 1200, 675),
  "indoor-games-for-cats": unsplash("1545249390-6bdfa286032f", 1200, 675),
  "first-aquarium-guide": unsplash("1784766029024-fe0adb02c313", 1200, 675),
};

export const PAGE_PHOTOS = {
  login: unsplash("1522276498395-f4f68f7f8454", 900, 1100),
  about: unsplash("1553322378-eb94e5966b0c", 1200, 800),
  offers: unsplash("1568640347023-a616a30bc3bd", 900, 700),
  bulk: unsplash("1591946559594-8c6d3b7391eb", 700, 700),
  coupons: unsplash("1741942732547-45a0d0c2b99a", 700, 700),
};
