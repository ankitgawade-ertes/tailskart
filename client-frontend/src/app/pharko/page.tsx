import type { Metadata } from "next";
import { FileUp, ClipboardCheck, PackageCheck, ShieldCheck } from "lucide-react";
import { Breadcrumbs, SectionHeading } from "@/components/ui";
import PharkoUpload from "@/components/PharkoUpload";
import { serverGetSafe } from "@/lib/api";
import type { CareConfig } from "@/lib/types";
import { CARE_PHOTOS } from "@/data/images";
import ProductListing from "@/components/ProductListing";
import { categoryTitle } from "@/data/pets";
import type { Category, ProductList } from "@/lib/types";

export const metadata: Metadata = {
  title: "pharko — Veterinary pharmacy",
  description: "Upload your pet's prescription and collect it at the pharko counter inside Tailskart.",
  alternates: { canonical: "/pharko" },
};

const STEPS = [
  { Icon: FileUp, t: "Upload prescription", d: "Take a photo or choose a PDF of the prescription from your vet." },
  { Icon: ClipboardCheck, t: "pharko reviews it", d: "A pharmacist checks the prescription and stock. You’ll see each status here." },
  { Icon: PackageCheck, t: "Ready for pickup", d: "Collect at the pharko counter inside Tailskart. Show your reference number." },
];

export default async function PharkoPage({ searchParams }: { searchParams: Promise<{ medicine?: string }> }) {
  const medicine = ((await searchParams).medicine ?? "").slice(0, 120);
  const empty: ProductList = { items: [], total: 0, page: 1, limit: 24 };
  const [cfg, meds, cats] = await Promise.all([
    serverGetSafe<CareConfig>("/care/config", { branches: [], slots: [] }, 60),
    serverGetSafe<ProductList>("/products?group=Pharmacy&limit=24", empty, 60),
    serverGetSafe<{ items: Category[] }>("/categories", { items: [] }, 300),
  ]);
  const pharmacyCats = cats.items.filter((c) => c.group === "Pharmacy");
  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Pharmacy" }]} />

      {/* pharko uses its own master: Clear Blue on a white panel (brand book p.10/12). */}
      <section className="rounded-2xl border border-line bg-white px-6 py-10 md:px-12 md:py-12">
        <p className="text-4xl font-bold lowercase tracking-tight text-pharko md:text-5xl">pharko</p>
        <h1 className="mt-3 text-2xl font-bold text-ink md:text-[2.5rem] md:leading-[2.75rem]">Veterinary pharmacy</h1>
        <div className="grid items-center gap-6 md:grid-cols-[1fr_40%]">
          <p className="mt-2 max-w-xl text-muted">Prescriptions and refills for your pet, prepared by the pharko team and collected at the counter inside your Tailskart shop.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CARE_PHOTOS.pharko} alt="" className="hidden aspect-[16/9] w-full rounded-xl object-cover md:block" />
        </div>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ Icon, t, d }, i) => (
            <li key={t} className="rounded-xl bg-pharko-soft p-5">
              <span className="text-xs font-bold text-pharko">STEP {i + 1}</span>
              <Icon className="mt-2 h-6 w-6 text-pharko" aria-hidden />
              <p className="mt-2 font-bold text-ink">{t}</p>
              <p className="mt-1 text-sm text-ink/70">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {meds.total > 0 && (
        <section className="mt-12" aria-labelledby="shop-meds">
          <div id="shop-meds">
            <SectionHeading
              eyebrow="pharko shop"
              title="Medicines & supplements"
              subtitle="Dewormers, tick & flea care, supplements and medicated shampoos, delivered with your order. Medicines marked Rx need a vet’s prescription — upload it below."
            />
          </div>
          <ProductListing
            base={{ group: "Pharmacy" }}
            initial={meds}
            chips={pharmacyCats.map((c) => ({ label: categoryTitle(c), params: { category: c.slug } }))}
          />
        </section>
      )}

      <div id="upload" className="mt-12 grid scroll-mt-40 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {medicine && (
            <p className="mb-4 rounded-xl bg-pharko-soft px-4 py-3 text-sm text-pharko">
              Ordering <b>{medicine}</b>? Upload your vet’s prescription — we’ve added the medicine name to the note.
            </p>
          )}
          <PharkoUpload config={cfg} initialNote={medicine ? `Please fill: ${medicine}` : ""} />
        </section>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-white p-5 text-sm">
            <p className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4 text-pharko" /> Your privacy</p>
            <p className="mt-2 text-muted">
              We only ask for what the pharmacist needs. Your prescription is stored privately and only pharko staff handling your request can see it.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5 text-sm">
            <p className="font-bold">Questions about the medicine itself?</p>
            <p className="mt-2 text-muted">Dosage and treatment questions go to the vet who prescribed it. The pharko team can help with stock, pickup and your request status.</p>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Veterinary pharmacy sales at the pharko counter are billed by MODOS SIBIS PRIVATE LIMITED. Where a partner pharmacy fills your request, its name and address
            are shown before pickup.
          </p>
        </aside>
      </div>
    </div>
  );
}
