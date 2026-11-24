import type { Category, Order, OrderEvent, OrderItem, Product, ProductImage, Variant, Breed } from "@prisma/client";
import { PET_TO_API, orderNumber } from "./core.js";

type ProductWith = Product & { variants: Variant[]; images: ProductImage[]; category?: Category };

export const variantOut = (v: Variant) => ({
  id: v.id,
  label: v.label,
  sku: v.sku,
  price: v.price,
  mrp: v.mrp,
  grams: v.grams,
  stock: v.stock,
  inStock: v.stock > 0,
});

/** Products tagged "rx" need a vet's prescription. */
export const RX_TAG = "rx";

export const productCard = (p: ProductWith) => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  brand: p.brand,
  pet: PET_TO_API[p.pet],
  category: p.category ? { slug: p.category.slug, name: p.category.name } : undefined,
  kind: p.artKind,
  tint: p.tint,
  badge: p.badge,
  rating: p.rating,
  reviewCount: p.reviewCount,
  lifeStage: p.lifeStage,
  breedSize: p.breedSize,
  diet: p.diet,
  flavour: p.flavour,
  /** Prescription-only medicine: sold through pharko, not the normal cart. */
  rx: p.tags.includes(RX_TAG),
  images: p.images.sort((a, b) => a.sortOrder - b.sortOrder).map((i) => ({ url: i.url, alt: i.alt })),
  variants: p.variants.filter((v) => v.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map(variantOut),
});

export const productDetail = (p: ProductWith) => ({
  ...productCard(p),
  description: p.description,
  highlights: p.highlights,
  specs: p.specs as [string, string][],
  tags: p.tags,
});

export const categoryOut = (c: Category & { _count?: { products: number } }) => ({
  id: c.id,
  slug: c.slug,
  name: c.name,
  pet: PET_TO_API[c.pet],
  group: c.group,
  blurb: c.blurb,
  imageUrl: c.imageUrl,
  sortOrder: c.sortOrder,
  isActive: c.isActive,
  productCount: c._count?.products,
});

export const breedOut = (b: Breed) => ({ slug: b.slug, name: b.name, pet: PET_TO_API[b.pet], tint: b.tint, note: b.note, imageUrl: b.imageUrl });

export const orderOut = (o: Order & { items: OrderItem[]; events?: OrderEvent[] }) => ({
  id: o.id,
  number: orderNumber(o.seq),
  status: o.status,
  paymentStatus: o.paymentStatus,
  paymentMethod: o.paymentMethod,
  shippingSpeed: o.shippingSpeed,
  mrpTotal: o.mrpTotal,
  subtotal: o.subtotal,
  discount: o.discount,
  shippingFee: o.shippingFee,
  total: o.total,
  couponCode: o.couponCode,
  pointsRedeemed: o.pointsRedeemed,
  pointsEarned: o.pointsEarned,
  address: o.address,
  placedAt: o.placedAt,
  createdAt: o.createdAt,
  items: o.items.map((i) => ({
    id: i.id,
    productId: i.productId,
    variantId: i.variantId,
    slug: i.slug,
    name: i.name,
    brand: i.brand,
    variantLabel: i.variantLabel,
    image: i.image,
    kind: i.artKind,
    tint: i.tint,
    price: i.price,
    mrp: i.mrp,
    qty: i.qty,
  })),
  events: o.events?.map((e) => ({ status: e.status, note: e.note, createdAt: e.createdAt })),
});
