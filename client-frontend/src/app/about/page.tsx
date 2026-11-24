import Link from "next/link";
import type { Metadata } from "next";
import { Heart, BadgeCheck, Truck, Leaf } from "lucide-react";
import { Breadcrumbs, btn } from "@/components/ui";
import { PAGE_PHOTOS } from "@/data/images";
import { getCmsPage, parseBlocks } from "@/lib/cms";
import { CmsBody } from "@/components/CmsBody";

export const metadata: Metadata = { title: "Our Story" };

export default async function AboutPage() {
  const cms = await getCmsPage("about");
  const blocks = cms ? parseBlocks(cms.body) : [];
  const introIdx = blocks.findIndex((b) => b.p);
  const intro = introIdx >= 0 ? blocks[introIdx].p : null;
  const rest = blocks.filter((_, i) => i !== introIdx);
  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Our story" }]} />
      <section className="relative overflow-hidden rounded-[36px] bg-brand px-6 py-14 text-white md:px-14 md:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-fold">Our story</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold leading-tight md:text-6xl">{cms?.title || "Made by pet parents, for pet parents"}</h1>
        <p className="mt-5 max-w-xl text-lg text-white/75">
          {intro ??
            "Placeholder story: Tailskart started with a simple frustration — running out of our dog’s food on a Sunday night. We wanted a store that stocks the good stuff, delivers fast and actually picks up the phone. Replace this with your own story."}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PAGE_PHOTOS.about} alt="" className="absolute inset-y-0 right-0 hidden h-full w-[40%] object-cover opacity-90 lg:block" />
      </section>

      {rest.length > 0 && (
        <section className="mx-auto mt-12 max-w-3xl rounded-[32px] bg-white p-7 shadow-soft md:p-10">
          <CmsBody blocks={rest} />
        </section>
      )}

      <section className="mt-12 grid gap-4 md:grid-cols-4">
        {[
          [Heart, "Pets first", "Every product we stock is one we’d give our own pets."],
          [BadgeCheck, "Always genuine", "Sourced from brands and authorised distributors only."],
          [Truck, "Fast & careful", "Packed with care and delivered quickly to your door."],
          [Leaf, "Kinder packaging", "Recyclable boxes and less plastic wherever we can."],
        ].map(([Icon, t, d]) => {
          const I = Icon as typeof Heart;
          return (
            <div key={t as string} className="rounded-3xl bg-white p-6 shadow-soft">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft"><I className="h-6 w-6 text-brand" /></span>
              <p className="mt-4 font-display text-xl font-semibold text-brand">{t as string}</p>
              <p className="mt-1 text-sm text-muted">{d as string}</p>
            </div>
          );
        })}
      </section>

      <section className="mt-12 grid grid-cols-2 gap-4 rounded-[32px] bg-sand p-8 text-center md:grid-cols-4">
        {[
          ["7-day", "Easy returns"],
          ["100%", "Genuine products"],
          ["COD", "Cash on delivery"],
          ["24×7", "WhatsApp support"],
        ].map(([a, b]) => (
          <div key={b}>
            <p className="font-display text-4xl font-semibold text-brand">{a}</p>
            <p className="text-sm text-muted">{b}</p>
          </div>
        ))}
      </section>

      <section className="mt-12 text-center">
        <h2 className="font-display text-3xl font-semibold text-brand">Come say hi</h2>
        <p className="mt-2 text-muted">Questions, feedback or just a cute pet photo — we’d love to hear from you.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/contact" className={btn.primary}>Contact us</Link>
          <Link href="/pets/dogs" className={btn.ghost}>Start shopping</Link>
        </div>
      </section>
    </div>
  );
}
