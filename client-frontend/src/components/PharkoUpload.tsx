"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Camera, FileText, RefreshCw, CheckCircle2 } from "lucide-react";
import { ApiError, api, apiUpload } from "@/lib/api";
import { input } from "./ui";
import { useStore } from "@/lib/store";
import type { CareConfig, Prescription, PrescriptionStatus } from "@/lib/types";

// Status wording follows the pharko voice: one plain instruction per state.
const STATUS: Record<PrescriptionStatus, { label: string; tone: string; help: (p: Prescription) => string }> = {
  RECEIVED: { label: "Received", tone: "bg-sand text-ink", help: () => "Your prescription has been received. The pharko team will review it." },
  IN_REVIEW: { label: "In review", tone: "bg-pharko-soft text-pharko", help: () => "A pharmacist is checking your prescription and stock." },
  NEEDS_INFO: { label: "Action needed", tone: "bg-sun-soft text-ink", help: () => "The pharmacist needs something from you — see the note below." },
  READY_FOR_PICKUP: {
    label: "Ready for pickup",
    tone: "bg-pharko text-white",
    help: (p) => `Ready for pickup at the pharko counter inside Tailskart, ${p.branch}. Show reference ${p.reference}.`,
  },
  COLLECTED: { label: "Collected", tone: "bg-accent-soft text-ink", help: () => "Collected. Thank you." },
  REJECTED: { label: "Can’t be filled", tone: "bg-red-50 text-red-700", help: () => "We couldn’t fill this prescription — see the note below." },
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,application/pdf";

export default function PharkoUpload({ config, initialNote = "" }: { config: CareConfig; initialNote?: string }) {
  const { user, ready } = useStore();
  const [petName, setPetName] = useState("");
  const [branch, setBranch] = useState(config.branches[0] ?? "");
  const [note, setNote] = useState(initialNote);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Prescription[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => api<{ items: Prescription[] }>("/me/prescriptions").then((r) => setItems(r.items)).catch(() => {});
  useEffect(() => {
    if (user) load();
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!file) return setErr("Please add a photo or PDF of the prescription");
    if (file.size > 8 * 1024 * 1024) return setErr("That file is larger than 8 MB. Try a smaller photo.");
    const form = new FormData();
    form.append("petName", petName);
    form.append("branch", branch);
    form.append("note", note);
    form.append("file", file);
    setBusy(true);
    try {
      await apiUpload<Prescription>("/pharko/prescriptions", form);
      setPetName("");
      setNote("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return <div className="rounded-2xl border border-line bg-white p-8 text-sm text-muted">Loading…</div>;

  if (!user) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8">
        <h2 className="text-[1.375rem] font-bold">Upload prescription</h2>
        <p className="mt-1 text-muted">Log in with your mobile number so we can tell you when it’s ready for pickup.</p>
        <Link href="/login?next=/pharko" className="mt-6 inline-flex rounded-lg bg-pharko px-6 py-3 text-sm font-bold text-white hover:opacity-90">
          Log in to continue
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-6 md:p-8">
        <h2 className="text-[1.375rem] font-bold">Upload prescription</h2>
        <p className="mt-1 text-sm text-muted">This is separate from your shopping cart. Payment is taken at the counter.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Pet’s name</span>
            <input value={petName} onChange={(e) => setPetName(e.target.value)} required maxLength={60} className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Pickup at</span>
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className={input}>
              {config.branches.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-muted">Prescription</span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-line p-5 text-left hover:border-pharko"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-pharko-soft">
                {file ? <FileText className="h-5 w-5 text-pharko" /> : <Camera className="h-5 w-5 text-pharko" />}
              </span>
              <span className="min-w-0 text-sm">
                <span className="block truncate font-bold">{file ? file.name : "Take a photo or choose a file"}</span>
                <span className="text-muted">JPG, PNG, HEIC or PDF · up to 8 MB · make sure every word is readable</span>
              </span>
            </button>
            <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-muted">Note for the pharmacist (optional)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="e.g. need a refill of the same tablets" className={input} />
          </label>
        </div>
        {err && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
        <button disabled={busy} className="mt-6 inline-flex rounded-lg bg-pharko px-6 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
          {busy ? "Uploading…" : "Submit to pharko"}
        </button>
      </form>

      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Your prescriptions</h3>
          <button onClick={load} className="flex items-center gap-1 text-xs font-bold text-pharko"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
        </div>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing submitted yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {items.map((p) => (
              <PrescriptionRow key={p.id} p={p} onChange={load} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PrescriptionRow({ p, onChange }: { p: Prescription; onChange: () => void }) {
  const s = STATUS[p.status];
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const reupload = async (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    setErr("");
    try {
      await apiUpload(`/me/prescriptions/${p.reference}/file`, form, "PUT");
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm">
          <b className="tabular">{p.reference}</b> · {p.petName} · {p.branch}
          <span className="block text-xs text-muted">Submitted {new Date(p.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${s.tone}`}>
          {p.status === "READY_FOR_PICKUP" && <CheckCircle2 className="h-3.5 w-3.5" />} {s.label}
        </span>
      </div>
      <p className="mt-2 text-sm text-ink/80">{s.help(p)}</p>
      {p.staffNote && <p className="mt-2 rounded-lg bg-sun-soft px-3 py-2 text-sm"><b>Pharmacist’s note:</b> {p.staffNote}</p>}
      {p.status === "NEEDS_INFO" && (
        <>
          <button onClick={() => ref.current?.click()} disabled={busy} className="mt-3 rounded-lg border border-pharko px-4 py-2 text-sm font-bold text-pharko hover:bg-pharko-soft disabled:opacity-50">
            {busy ? "Uploading…" : "Upload a clearer copy"}
          </button>
          <input ref={ref} type="file" accept={ACCEPT} hidden onChange={(e) => reupload(e.target.files?.[0])} />
          {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
        </>
      )}
    </li>
  );
}
