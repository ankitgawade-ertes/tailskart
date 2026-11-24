"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Horizontal scroll row with arrow buttons on desktop.
export default function Rail({ children, itemClass = "w-[46%] sm:w-[31%] lg:w-[23%] xl:w-[19%]" }: { children: React.ReactNode[]; itemClass?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const go = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div className="relative">
      <div ref={ref} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:gap-4 md:px-0">
        {children.map((c, i) => (
          <div key={i} className={`shrink-0 snap-start ${itemClass}`}>
            {c}
          </div>
        ))}
      </div>
      <button
        onClick={() => go(-1)}
        aria-label="Scroll left"
        className="absolute -left-4 top-1/3 hidden h-10 w-10 place-items-center rounded-xl border border-line bg-white shadow-soft hover:bg-accent-soft md:grid"
      >
        <ChevronLeft className="h-5 w-5 text-brand" />
      </button>
      <button
        onClick={() => go(1)}
        aria-label="Scroll right"
        className="absolute -right-4 top-1/3 hidden h-10 w-10 place-items-center rounded-xl border border-line bg-white shadow-soft hover:bg-accent-soft md:grid"
      >
        <ChevronRight className="h-5 w-5 text-brand" />
      </button>
    </div>
  );
}
