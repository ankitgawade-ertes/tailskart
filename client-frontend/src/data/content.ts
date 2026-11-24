// Placeholder site content. Replace contact details before launch.

export const SITE = {
  name: "Tailskart",
  tagline: "Their everyday, delivered.",
  phone: "+91 90000 00000",
  phoneHref: "tel:+919000000000",
  whatsapp: "https://wa.me/919000000000",
  email: "hello@tailskart.in",
  address: "Tailskart HQ, 2nd Floor, Placeholder Road, Bengaluru 560001",
  hours: "Mon–Sun, 9am – 9pm",
  social: {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    youtube: "https://youtube.com/",
    x: "https://x.com/",
  },
  freeShippingAbove: 499,
  codRange: [299, 5000] as [number, number],
  firstOrderCode: "TAILS15",
};

export const ANNOUNCEMENTS = [
  `Free delivery on orders above ₹${SITE.freeShippingAbove}`,
  `New here? Use code ${SITE.firstOrderCode} for 15% off your first order`,
  "Same-day delivery in select cities",
];

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  read: string;
  date: string;
  tint: string;
  emoji: string;
  body: { h?: string; p?: string; list?: string[] }[];
}

export const POSTS: BlogPost[] = [
  {
    slug: "first-week-with-a-new-puppy",
    title: "Your first week with a new puppy: a calm, simple plan",
    excerpt: "From the car ride home to the first night's sleep, here's how to help your puppy settle in without the chaos.",
    category: "Puppy care", read: "6 min", date: "2026-11-10", tint: "#fbe3b9", emoji: "🐶",
    body: [
      { p: "Bringing a puppy home is exciting — and a little overwhelming for everyone, puppy included. A simple routine in the first week builds trust and makes training much easier later." },
      { h: "Before they arrive" },
      { list: ["Pick one quiet corner for a bed and water bowl", "Buy the same food the breeder or shelter was using", "Puppy-proof cables, shoes and low shelves", "Keep a small pack of soft training treats ready"] },
      { h: "Days one to three" },
      { p: "Keep things boring. Short play sessions, lots of naps and frequent toilet breaks — right after waking, eating and playing. Praise every success outside." },
      { h: "Days four to seven" },
      { p: "Start name recognition and 'sit' with tiny treats. Introduce the collar for short periods. If you plan to switch food, mix it in slowly over 7–10 days." },
    ],
  },
  {
    slug: "how-to-choose-cat-litter",
    title: "Clumping, tofu or silica? How to choose the right cat litter",
    excerpt: "Every litter type has trade-offs. We compare odour control, dust, cost and how easy each one is to clean.",
    category: "Cat care", read: "5 min", date: "2026-11-02", tint: "#e3dcf3", emoji: "🐱",
    body: [
      { p: "Cats are particular about their litter. The right choice keeps your home fresh and your cat happy to use the box." },
      { h: "Clumping bentonite" },
      { p: "Forms tight clumps that are easy to scoop. Great odour control and budget-friendly, but can be dusty and heavy." },
      { h: "Tofu litter" },
      { p: "Plant-based, light and low-dust. Small amounts can often be flushed. Costs a little more but many owners love it." },
      { h: "Our tip" },
      { p: "Switch slowly: mix 25% new litter into the old and increase over a week so your cat doesn't refuse the box." },
    ],
  },
  {
    slug: "winter-care-for-dogs",
    title: "Winter care for dogs: coats, paws and cosy beds",
    excerpt: "Short-coated and senior dogs feel the cold the most. Here's how to keep them warm and comfortable.",
    category: "Seasonal", read: "4 min", date: "2026-10-26", tint: "#f1cfc2", emoji: "🧣",
    body: [
      { p: "Most Indian winters are mild, but early mornings can be chilly — especially for small, short-haired and older dogs." },
      { list: ["Use a sweater for early walks if your dog shivers", "Lift beds off cold floors", "Wipe paws after walks to remove dust and dampness", "Keep water fresh — dogs still dehydrate in winter"] },
    ],
  },
  {
    slug: "reading-pet-food-labels",
    title: "How to read a pet food label in 2 minutes",
    excerpt: "Protein first? Grain-free? Here's what the label really tells you — and what it doesn't.",
    category: "Nutrition", read: "7 min", date: "2026-10-15", tint: "#d6ecc9", emoji: "🥣",
    body: [
      { p: "Pet food labels look complicated, but you only need to check a few things." },
      { list: ["Life stage: puppy, adult or senior", "The first ingredient — ideally a named protein", "Guaranteed analysis for protein and fat", "Feeding guide based on weight"] },
      { p: "When in doubt, ask your vet which nutrients matter most for your pet's age and health." },
    ],
  },
  {
    slug: "indoor-games-for-cats",
    title: "7 easy indoor games to keep your cat happy",
    excerpt: "Bored cats get into trouble. These quick games use toys you probably already have.",
    category: "Play", read: "4 min", date: "2026-10-05", tint: "#cfe3f6", emoji: "🧶",
    body: [
      { p: "Ten minutes of play twice a day can reduce scratching, night-time zoomies and boredom." },
      { list: ["Feather wand chase", "Treat hunt around the room", "Cardboard box fort", "Paper ball fetch", "Laser pointer (end on a real toy!)", "Puzzle feeder dinner", "Window bird watching"] },
    ],
  },
  {
    slug: "first-aquarium-guide",
    title: "Setting up your first aquarium: a beginner's guide",
    excerpt: "Tank size, filters, cycling and the hardiest first fish — everything to get started right.",
    category: "Small pets", read: "8 min", date: "2026-09-28", tint: "#cdeaf2", emoji: "🐠",
    body: [
      { p: "A healthy aquarium starts before you add a single fish. Patience in the first few weeks makes all the difference." },
      { list: ["Start with at least 40 litres — bigger is more stable", "Run the filter for 2–4 weeks to cycle the tank", "Add fish slowly, a few at a time", "Feed only what they finish in 2 minutes"] },
    ],
  },
];

export const FAQS: { q: string; a: string; group: string }[] = [
  { group: "Orders & delivery", q: "How fast is delivery?", a: "Most orders arrive in 1–3 days. Same-day delivery is available in select cities — enter your pincode on any product to check." },
  { group: "Orders & delivery", q: "Is there a delivery charge?", a: `Delivery is free on orders above ₹${SITE.freeShippingAbove}. Below that, a small fee of ₹49 applies.` },
  { group: "Orders & delivery", q: "How do I track my order?", a: "Go to My Account → Orders to see live status. We also send updates on WhatsApp and SMS." },
  { group: "Payments", q: "Which payment methods do you accept?", a: "UPI, debit and credit cards, net banking, wallets and cash on delivery on eligible orders." },
  { group: "Payments", q: "Is cash on delivery available?", a: `Yes, COD is available for orders between ₹${SITE.codRange[0]} and ₹${SITE.codRange[1]}.` },
  { group: "Returns", q: "What is your return policy?", a: "Unopened products can be returned within 7 days of delivery. Damaged or wrong items are replaced free of charge." },
  { group: "Returns", q: "When will I get my refund?", a: "Refunds are processed within 2–3 working days after the return is picked up and checked." },
  { group: "Products", q: "Are all products genuine?", a: "Yes. We source directly from brands and authorised distributors, and check expiry dates on every food item." },
  { group: "Products", q: "How do I choose the right food size?", a: "Each product page shows the price per 100g, so you can compare packs. Larger packs usually cost less per kg." },
];

export const POLICIES: Record<string, { title: string; updated: string; body: { h?: string; p?: string; list?: string[] }[] }> = {
  returns: {
    title: "Returns & Refunds",
    updated: "November 2026",
    body: [
      { p: "We want you and your pet to love every order. If something isn't right, we'll make it easy." },
      { h: "Eligible returns" },
      { list: ["Unopened, unused products within 7 days of delivery", "Damaged, leaking or wrong items (report within 48 hours with photos)", "Products near expiry on delivery"] },
      { h: "Not eligible" },
      { list: ["Opened food and treats (unless damaged)", "Used grooming items and toys", "Gift cards"] },
      { h: "Refunds" },
      { p: "Refunds go back to your original payment method within 2–3 working days after pickup. COD orders are refunded to your bank account or as store credit." },
    ],
  },
  shipping: {
    title: "Shipping Policy",
    updated: "November 2026",
    body: [
      { p: `Free delivery on orders above ₹${SITE.freeShippingAbove}. Orders below this have a ₹49 delivery fee.` },
      { list: ["Metro cities: 1–2 days", "Same-day delivery in select pincodes for orders before 2pm", "Rest of India: 3–6 days"] },
      { p: "You'll get tracking updates by SMS, email and WhatsApp once your order ships." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: "November 2026",
    body: [
      { p: "This is placeholder text. Replace it with a privacy policy reviewed for your business before launch." },
      { h: "What we collect" },
      { list: ["Name, phone, email and delivery address", "Order history and pet profile details you choose to share", "Basic device and usage data to improve the site"] },
      { h: "How we use it" },
      { p: "To deliver orders, provide support, and — only with your consent — send offers. We never sell your data." },
    ],
  },
  terms: {
    title: "Terms of Use",
    updated: "November 2026",
    body: [
      { p: "This is placeholder text. Replace it with terms reviewed for your business before launch." },
      { h: "Using the site" },
      { p: "By placing an order you confirm the details you give are accurate. Prices and availability can change without notice." },
      { h: "Offers & coupons" },
      { p: "Only one coupon can be used per order. Coupons have no cash value and may be withdrawn at any time." },
    ],
  },
};

/**
 * Real customer testimonials for the homepage. Leave empty until you have genuine quotes —
 * the section is hidden when this list is empty.
 */
export const TESTIMONIALS: { name: string; city: string; text: string; product: string; rating: number }[] = [];
