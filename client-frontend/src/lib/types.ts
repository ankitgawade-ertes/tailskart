// Shapes returned by the Tailskart API. All money values are integers in paise.

export type Pet = "dog" | "cat" | "small" | "parent";
export type ArtKind = "bag" | "pouch" | "jar" | "treat" | "toy" | "collar" | "bed" | "bottle" | "litter" | "bowl" | "tee";

export interface Variant {
  id: string;
  label: string;
  sku: string | null;
  price: number;
  mrp: number;
  grams: number | null;
  stock: number;
  inStock: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  pet: Pet;
  category?: { slug: string; name: string };
  kind: ArtKind;
  tint: string;
  badge: "Bestseller" | "New" | "Tailskart Pick" | "Deal" | null;
  rating: number;
  reviewCount: number;
  lifeStage: string | null;
  breedSize: string | null;
  diet: string | null;
  flavour: string | null;
  /** Prescription-only medicine: ordered through pharko with a vet's prescription. */
  rx?: boolean;
  images: { url: string; alt: string }[];
  variants: Variant[];
}

export interface ProductDetail extends Product {
  description: string;
  highlights: string[];
  specs: [string, string][];
  tags: string[];
  /** Coupon badges that apply to this product (from Admin → Coupons). */
  offers?: { code: string; badge: string; description: string }[];
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  pet: Pet;
  group: string;
  blurb: string;
  imageUrl?: string | null;
  productCount?: number;
}

export interface Breed {
  slug: string;
  name: string;
  pet: Pet;
  tint: string;
  note: string;
  imageUrl?: string | null;
  productCount?: number;
}

export type Facet = { value: string; count: number }[];

export interface ProductList {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  facets?: Record<"brand" | "lifeStage" | "breedSize" | "diet" | "flavour", Facet>;
}

export interface Customer {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  createdAt: string;
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  label: "Home" | "Work" | "Other";
  isDefault: boolean;
}

export interface PetProfile {
  id: string;
  name: string;
  type: "Dog" | "Cat" | "Other";
  breed: string | null;
  birthday: string | null;
}

export type OrderStatus = "PENDING_PAYMENT" | "PLACED" | "PACKED" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "RETURNED";

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  paymentMethod: "COD" | "RAZORPAY" | "MOCK";
  shippingSpeed: "STANDARD" | "EXPRESS";
  mrpTotal: number;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  couponCode: string | null;
  address: Omit<Address, "id" | "isDefault">;
  placedAt: string | null;
  createdAt: string;
  items: {
    id: string;
    productId: string | null;
    variantId: string | null;
    slug: string;
    name: string;
    brand: string;
    variantLabel: string;
    image: string | null;
    kind: ArtKind;
    tint: string;
    price: number;
    mrp: number;
    qty: number;
  }[];
  events?: { status: OrderStatus; note: string | null; createdAt: string }[];
}

export interface QuoteLine {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  brand: string;
  label: string;
  price: number;
  mrp: number;
  qty: number;
  stock: number;
  image: string | null;
  kind: ArtKind;
  tint: string;
  lineTotal: number;
}

export interface Quote {
  lines: QuoteLine[];
  issues: { variantId: string; message: string }[];
  mrpTotal: number;
  subtotal: number;
  discount: number;
  coupon: { code: string; description: string } | null;
  couponError?: string;
  /** Loyalty points: balance (logged-in customers), how many this quote uses, and their value in paise. */
  points?: { balance: number; redeemed: number; discount: number };
  shippingFee: number;
  expressFee: number;
  total: number;
  delivery: { pincode: string | null; serviceable: boolean; sameDay: boolean; etaDays: [number, number] };
  cod: { available: boolean; reason: string | null };
}

export interface StoreConfig {
  freeShippingMin: number;
  shippingFee: number;
  expressFee: number;
  cod: { enabled: boolean; min: number; max: number };
  payments: { provider: "mock" | "razorpay"; razorpayKeyId: string | null };
}

export interface ReviewList {
  rating: number;
  count: number;
  distribution: number[];
  items: { id: string; rating: number; title: string; body: string; verified: boolean; author: string; createdAt: string }[];
}

export interface CareConfig {
  branches: string[];
  slots: string[];
}

export interface Appointment {
  id: string;
  reference: string;
  petName: string;
  species: string;
  reason: string;
  preferredDate: string;
  preferredSlot: string;
  branch: string;
  status: "REQUESTED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  staffNote: string | null;
  createdAt: string;
}

export type PrescriptionStatus = "RECEIVED" | "IN_REVIEW" | "NEEDS_INFO" | "READY_FOR_PICKUP" | "COLLECTED" | "REJECTED";

export interface Prescription {
  id: string;
  reference: string;
  petName: string;
  branch: string;
  note: string | null;
  fileName: string;
  status: PrescriptionStatus;
  staffNote: string | null;
  readyAt: string | null;
  collectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
