import type { Metadata } from "next";
import { Stethoscope, Microscope, Syringe, HeartPulse, Phone, ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/ui";
import AmetadBooking from "@/components/AmetadBooking";
import { serverGetSafe } from "@/lib/api";
import { getSite } from "@/lib/site";
import type { CareConfig } from "@/lib/types";
import { BLOG_PHOTOS, CARE_PHOTOS, PET_PHOTOS } from "@/data/images";

export const metadata: Metadata = {
  title: "ametad — Veterinary care",
  description: "Book an appointment at an Ametad veterinary hospital: consultations, diagnostics and specialist care.",
  alternates: { canonical: "/ametad" },
};

// Service cards: tilted colour cards with a photo in an arch (straighten on hover).
const SERVICES = [
  { Icon: Stethoscope, t: "Consultations", d: "General check-ups and illness visits with a veterinarian.", photo: CARE_PHOTOS.ametad, bg: "bg-ametad", text: "text-white", tilt: "md:-rotate-3" },
  { Icon: Syringe, t: "Vaccinations", d: "Core vaccines and boosters on your pet's schedule.", photo: BLOG_PHOTOS["first-week-with-a-new-puppy"], bg: "bg-sun", text: "text-ink", tilt: "md:rotate-2 md:translate-y-4" },
  { Icon: Microscope, t: "Diagnostics", d: "Lab tests and imaging, with results explained by the vet.", photo: PET_PHOTOS.cat, bg: "bg-brand", text: "text-white", tilt: "md:-rotate-2" },
  { Icon: HeartPulse, t: "Specialist care", d: "Referral to the right specialist when your pet needs it.", photo: PET_PHOTOS.dog, bg: "bg-pharko", text: "text-white", tilt: "md:rotate-3 md:translate-y-4" },
];

export default async function AmetadPage() {
  const [cfg, SITE] = await Promise.all([serverGetSafe<CareConfig>("/care/config", { branches: [], slots: [] }, 60), getSite()]);
  return (
    <div className="container-x">
      <Breadcrumbs items={[{ label: "Veterinary care" }]} />

      {/* Ametad keeps its own identity inside the Tailskart host (brand book p.7). */}
      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="relative overflow-hidden bg-ametad px-6 py-10 text-white md:px-12 md:py-14">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CARE_PHOTOS.ametad} alt="" className="absolute inset-y-0 right-0 hidden h-full w-[45%] object-cover md:block" />
          <div className="relative md:max-w-[52%]">
          <p className="text-4xl font-bold lowercase tracking-tight md:text-5xl">ametad</p>
          <h1 className="mt-3 text-2xl font-bold md:text-[2.5rem] md:leading-[2.75rem]">Veterinary hospital</h1>
          <p className="mt-2 max-w-xl text-white/85">Consultations, diagnostics and specialist care. Request a visit below and the Ametad team will call to confirm your time.</p>
          <a href="#book" className="mt-6 inline-flex items-center rounded-lg bg-white px-5 py-3 text-sm font-bold text-ametad hover:bg-ametad-soft">
            Book an appointment
          </a>
          </div>
        </div>
      </section>

      {/* What you can do with ametad */}
      <section className="mt-14 md:mt-20" aria-labelledby="services-heading">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <h2 id="services-heading" className="font-display text-4xl font-bold leading-[1.05] text-ink md:text-6xl">
            What you can do
            <br />
            with <span className="lowercase text-ametad">ametad</span>
          </h2>
          <p className="relative w-fit max-w-[15rem] px-6 py-5 text-sm leading-snug text-ink/80">
            {/* hand-drawn style ring around the note */}
            <span aria-hidden className="absolute inset-0 -rotate-6 rounded-[50%] border-2 border-sun" />
            Healthier pets, happier homes — care from vets who know them by name.
          </p>
        </div>
        <div className="no-scrollbar -mx-4 mt-10 flex snap-x gap-4 overflow-x-auto px-4 pb-8 pt-2 md:mx-0 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 lg:grid-cols-4">
          {SERVICES.map(({ Icon, t, d, photo, bg, text, tilt }) => (
            <a
              key={t}
              href="#book"
              className={`group relative flex min-h-[430px] w-[78%] shrink-0 snap-start flex-col overflow-hidden rounded-[28px] p-6 shadow-lift transition duration-300 hover:rotate-0 hover:-translate-y-2 sm:w-[48%] md:w-auto ${bg} ${text} ${tilt}`}
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/20 backdrop-blur">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-3xl font-bold leading-tight">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed opacity-90">{d}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold">
                Book this <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
              <span className="absolute inset-x-6 bottom-0 h-[45%] overflow-hidden rounded-t-[999px] border-4 border-b-0 border-white/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
              </span>
            </a>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section id="book" className="scroll-mt-40 lg:col-span-2">
          <AmetadBooking config={cfg} />
        </section>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="font-bold text-red-800">Emergency?</p>
            <p className="mt-1 text-sm text-red-900/80">Don’t wait for a booking. Go to the nearest veterinary hospital or call the Ametad front desk.</p>
            <a href={SITE.phoneHref} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-red-800">
              <Phone className="h-4 w-4" /> {SITE.phone}
            </a>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5 text-sm">
            <p className="font-bold">What happens next</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-muted">
              <li>You request a day and time.</li>
              <li>Ametad calls you to confirm the appointment.</li>
              <li>Your vet issues any prescription. You can fill it at the pharko counter inside Tailskart.</li>
            </ol>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Clinical care is provided by Ametad, operated by ZIVAL SIBIS. The treating clinician owns your pet’s clinical record and answers prescribing questions.
            Tailskart only passes your request to the hospital.
          </p>
        </aside>
      </div>
    </div>
  );
}
