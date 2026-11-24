"use client";

import { useState } from "react";
import { Copy, Check, MessageCircle, Share2 } from "lucide-react";
import { Breadcrumbs, btn } from "@/components/ui";

export default function ReferPage() {
  const [copied, setCopied] = useState(false);
  const site = typeof window !== "undefined" ? window.location.origin : "";
  const msg = `I shop for my pet on Tailskart — fast delivery and genuine products. Take a look: ${site}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(site);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Refer a friend" }]} />
      <section className="relative overflow-hidden rounded-[36px] bg-brand px-6 py-12 text-white md:px-14 md:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">Refer a friend</p>
        <h1 className="mt-2 max-w-xl font-display text-4xl font-semibold leading-tight md:text-6xl">Share Tailskart with your pet pack</h1>
        <p className="mt-3 max-w-md text-lg text-white/85">Know someone who’d love fast, genuine pet supplies? Send them our way.</p>
        <span aria-hidden className="absolute -bottom-8 right-6 text-[150px] md:text-[220px]">🐾</span>
      </section>

      <div className="mx-auto -mt-10 max-w-2xl rounded-[28px] bg-white p-6 shadow-lift md:p-8">
        <p className="text-sm font-semibold text-muted">Share this link</p>
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-dashed border-brand/40 bg-brand-soft p-2 pl-4">
          <span className="flex-1 truncate text-sm font-bold text-brand">{site || "tailskart"}</span>
          <button onClick={copy} className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm font-bold text-brand shadow-soft">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className={btn.dark}>
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
          <button
            onClick={() => {
              if (navigator.share) navigator.share({ title: "Tailskart", text: msg }).catch(() => {});
              else copy();
            }}
            className={btn.ghost}
          >
            <Share2 className="h-4 w-4" /> More options
          </button>
        </div>
      </div>
    </div>
  );
}
