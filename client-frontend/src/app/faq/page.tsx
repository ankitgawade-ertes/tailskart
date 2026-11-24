import Link from "next/link";
import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { Breadcrumbs, PageHero, btn } from "@/components/ui";
import { FAQS } from "@/data/content";
import { getCmsPage, parseBlocks } from "@/lib/cms";
import { CmsBody } from "@/components/CmsBody";

type Faq = { group: string; q: string; a: string };

/** "## Group" headings, "### Question" lines, answer text below each question. */
function faqsFrom(body: string): Faq[] {
  const out: Faq[] = [];
  let group = "General";
  for (const b of parseBlocks(body)) {
    if (b.h) group = b.h;
    else if (b.h3) out.push({ group, q: b.h3, a: "" });
    else if (out.length) {
      const last = out[out.length - 1];
      const text = b.list ? b.list.map((l) => `• ${l}`).join(" ") : (b.p ?? "");
      last.a = last.a ? `${last.a} ${text}` : text;
    }
  }
  return out;
}

export const metadata: Metadata = { title: "Help & FAQs" };

export default async function FaqPage() {
  const cms = await getCmsPage("faq");
  const fromCms = cms ? faqsFrom(cms.body) : [];
  const list: Faq[] = fromCms.length ? fromCms : FAQS;
  const groups = Array.from(new Set(list.map((f) => f.group)));
  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "FAQs" }]} />
      <PageHero title="Help & FAQs" subtitle="Quick answers about orders, delivery, payments and returns." tint="#e7f3fd" emoji="💬" />
      <div className="mx-auto mt-10 max-w-3xl space-y-10">
        {cms && !fromCms.length && <CmsBody blocks={parseBlocks(cms.body)} className="prose-tk rounded-2xl bg-white p-7 shadow-soft" />}
        {(!cms || fromCms.length > 0) && groups.map((g) => (
          <section key={g}>
            <h2 className="mb-3 font-display text-2xl font-semibold text-brand">{g}</h2>
            <div className="space-y-2">
              {list.filter((f) => f.group === g).map((f) => (
                <details key={f.q} className="group rounded-2xl bg-white p-5 shadow-soft">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold">
                    {f.q}
                    <ChevronDown className="h-5 w-5 shrink-0 text-brand transition group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-ink/70">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
        <div className="rounded-3xl bg-brand p-8 text-center text-white">
          <p className="font-display text-2xl">Still need help?</p>
          <p className="mt-1 text-white/70">Our team usually replies within minutes on WhatsApp.</p>
          <Link href="/contact" className={`${btn.primary} mt-5`}>Contact us</Link>
        </div>
      </div>
    </div>
  );
}
