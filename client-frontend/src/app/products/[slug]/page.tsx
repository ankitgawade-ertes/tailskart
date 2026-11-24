import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Gallery, BuyBox, InfoTabs, Reviews } from "@/components/ProductDetail";
import ProductCard from "@/components/ProductCard";
import Rail from "@/components/Rail";
import { Breadcrumbs, SectionHeading } from "@/components/ui";
import { petById } from "@/data/pets";
import { serverGet, serverGetSafe } from "@/lib/api";
import type { Product, ProductDetail, ReviewList } from "@/lib/types";

type Payload = { product: ProductDetail; related: Product[]; more: Product[] };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await serverGetSafe<Payload | null>(`/products/${(await params).slug}`, null);
  if (!data) return {};
  const p = data.product;
  return {
    title: `${p.brand} ${p.name}`,
    description: p.description.slice(0, 160),
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { title: `${p.brand} ${p.name}`, images: p.images[0] ? [p.images[0].url] : undefined },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await serverGet<Payload>(`/products/${slug}`);
  if (!data) notFound();
  const { product, related, more } = data;
  const reviews = await serverGetSafe<ReviewList>(`/products/${slug}/reviews?limit=10`, { rating: 0, count: 0, distribution: [0, 0, 0, 0, 0], items: [] }, 60);
  const pet = petById(product.pet);
  const v = product.variants[0];
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  // Structured data for rich search results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${product.brand} ${product.name}`,
    brand: { "@type": "Brand", name: product.brand },
    description: product.description,
    image: product.images.map((i) => i.url),
    sku: v?.sku ?? undefined,
    ...(product.reviewCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviewCount } } : {}),
    offers: product.variants.map((x) => ({
      "@type": "Offer",
      priceCurrency: "INR",
      price: (x.price / 100).toFixed(2),
      availability: x.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${site}/products/${product.slug}`,
    })),
  };

  return (
    <div className="container-x pb-16 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Breadcrumbs
        items={[
          { label: pet.name, href: `/pets/${pet.slug}` },
          ...(product.category ? [{ label: product.category.name, href: `/collections/${product.category.slug}` }] : []),
          { label: product.name },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="lg:sticky lg:top-36 lg:self-start">
          <Gallery product={product} />
        </div>
        <BuyBox product={product} />
      </div>

      <div className="mt-12">
        <InfoTabs product={product} />
      </div>

      <Reviews slug={product.slug} initial={reviews} />

      {related.length > 0 && (
        <section className="mt-14">
          <SectionHeading title="You may also like" href={product.category ? `/collections/${product.category.slug}` : undefined} />
          <Rail>{related.map((p) => <ProductCard key={p.id} product={p} />)}</Rail>
        </section>
      )}
      {more.length > 0 && (
        <section className="mt-14">
          <SectionHeading title={`More for ${pet.name.toLowerCase()}`} href={`/pets/${pet.slug}`} />
          <Rail>{more.map((p) => <ProductCard key={p.id} product={p} />)}</Rail>
        </section>
      )}
    </div>
  );
}
