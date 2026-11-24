"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarCheck2 } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { input } from "./ui";
import { useStore } from "@/lib/store";
import type { Appointment, CareConfig } from "@/lib/types";

const STATUS: Record<Appointment["status"], string> = {
  REQUESTED: "Requested — we’ll call to confirm",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

export default function AmetadBooking({ config }: { config: CareConfig }) {
  const { user } = useStore();
  const [f, setF] = useState({ name: "", phone: "", email: "", petName: "", species: "Dog", reason: "", preferredDate: "", preferredSlot: config.slots[0] ?? "", branch: config.branches[0] ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Appointment | null>(null);
  const [mine, setMine] = useState<Appointment[]>([]);

  useEffect(() => {
    if (!user) return;
    setF((p) => ({ ...p, name: p.name || user.name || "", phone: p.phone || user.phone, email: p.email || user.email || "" }));
    api<{ items: Appointment[] }>("/me/appointments").then((r) => setMine(r.items)).catch(() => {});
  }, [user, done]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setBusy(true);
    try {
      setDone(await api<Appointment>("/ametad/appointments", { method: "POST", body: f }));
    } catch (err) {
      if (err instanceof ApiError && err.details && typeof err.details === "object") {
        setErrors(Object.fromEntries(Object.entries(err.details as Record<string, string[]>).map(([k, v]) => [k, v[0]])));
      } else setErrors({ form: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof typeof f, label: string, el: React.ReactNode) => (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      {el}
      {errors[k] && <span className="mt-1 block text-xs text-red-600">{errors[k]}</span>}
    </label>
  );
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  if (done) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center">
        <CalendarCheck2 className="mx-auto h-12 w-12 text-ametad" />
        <h2 className="mt-4 text-[1.375rem] font-bold">Request received</h2>
        <p className="mt-1 text-muted">
          Reference <b className="tabular text-ink">{done.reference}</b>. The Ametad team will call {f.phone ? `+91 ${f.phone}` : "you"} to confirm your appointment at {done.branch}.
        </p>
        <button onClick={() => setDone(null)} className="mt-6 rounded-lg border border-line px-4 py-2.5 text-sm font-bold text-ametad hover:bg-ametad-soft">
          Book another visit
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-6 md:p-8">
        <h2 className="text-[1.375rem] font-bold">Book an appointment</h2>
        <p className="mt-1 text-sm text-muted">Pick a preferred day and time. Ametad confirms by phone.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {field("petName", "Pet’s name", <input value={f.petName} onChange={set("petName")} required className={input} />)}
          {field(
            "species",
            "Species",
            <select value={f.species} onChange={set("species")} className={input}>
              {["Dog", "Cat", "Rabbit", "Bird", "Fish", "Other"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>,
          )}
          <div className="sm:col-span-2">
            {field("reason", "Reason for visit", <textarea value={f.reason} onChange={set("reason")} rows={3} required maxLength={500} placeholder="e.g. vaccination, skin itching, annual check-up" className={input} />)}
          </div>
          {field("preferredDate", "Preferred date", <input type="date" min={todayISO()} value={f.preferredDate} onChange={set("preferredDate")} required className={input} />)}
          {field(
            "preferredSlot",
            "Preferred time",
            <select value={f.preferredSlot} onChange={set("preferredSlot")} className={input}>
              {config.slots.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>,
          )}
          {field(
            "branch",
            "Hospital",
            <select value={f.branch} onChange={set("branch")} className={input}>
              {config.branches.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>,
          )}
          {field("name", "Your name", <input value={f.name} onChange={set("name")} required autoComplete="name" className={input} />)}
          {field("phone", "Mobile number", <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} required inputMode="numeric" autoComplete="tel-national" className={input} />)}
          {field("email", "Email (optional)", <input type="email" value={f.email} onChange={set("email")} autoComplete="email" className={input} />)}
        </div>
        {errors.form && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errors.form}</p>}
        <button disabled={busy} className="mt-6 inline-flex items-center rounded-lg bg-ametad px-6 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
          {busy ? "Sending…" : "Request appointment"}
        </button>
        {!user && (
          <p className="mt-3 text-xs text-muted">
            <Link href="/login?next=/ametad" className="font-bold text-ametad">Log in</Link> to see your bookings here later.
          </p>
        )}
      </form>

      {mine.length > 0 && (
        <div className="rounded-2xl border border-line bg-white p-6">
          <h3 className="font-bold">Your appointment requests</h3>
          <ul className="mt-3 divide-y divide-line text-sm">
            {mine.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span>
                  <b className="tabular">{a.reference}</b> · {a.petName} · {new Date(a.preferredDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, {a.preferredSlot}
                  {a.staffNote && <span className="block text-xs text-muted">{a.staffNote}</span>}
                </span>
                <span className="rounded-full bg-ametad-soft px-2.5 py-0.5 text-xs font-semibold text-ametad">{STATUS[a.status]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
