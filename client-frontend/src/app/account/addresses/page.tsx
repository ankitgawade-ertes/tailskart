"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, MapPin } from "lucide-react";
import { btn, input } from "@/components/ui";
import { api } from "@/lib/api";
import type { Address } from "@/lib/types";

type NewAddress = Omit<Address, "id" | "isDefault">;
const EMPTY: NewAddress = { name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "", label: "Home" };

export default function AddressesPage() {
  const [list, setList] = useState<Address[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");

  const load = () => api<{ items: Address[] }>("/me/addresses").then((r) => setList(r.items)).catch((e) => setErr((e as Error).message));
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setErr("");
    try {
      await api("/me/addresses", { method: "POST", body: { ...form, line2: form.line2 || null } });
      setForm(EMPTY);
      setAdding(false);
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const makeDefault = async (id: string) => {
    await api(`/me/addresses/${id}`, { method: "PUT", body: { isDefault: true } }).catch((e) => setErr((e as Error).message));
    load();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this address?")) return;
    await api(`/me/addresses/${id}`, { method: "DELETE" }).catch((e) => setErr((e as Error).message));
    load();
  };

  const f = (k: keyof NewAddress, ph: string, extra = "") => (
    <input value={(form[k] as string) ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={ph} aria-label={ph} className={`${input} ${extra}`} />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-brand">Saved addresses</h1>
        {!adding && <button onClick={() => setAdding(true)} className={btn.dark}><Plus className="h-4 w-4" /> Add address</button>}
      </div>
      {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}

      {adding && (
        <div className="grid gap-3 rounded-3xl bg-white p-6 shadow-soft sm:grid-cols-2">
          {f("name", "Full name")}
          {f("phone", "10-digit mobile")}
          {f("line1", "House no., building, street", "sm:col-span-2")}
          {f("line2", "Area, landmark (optional)", "sm:col-span-2")}
          {f("pincode", "Pincode")}
          {f("city", "City")}
          {f("state", "State")}
          <select value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value as Address["label"] })} className={input} aria-label="Address label">
            <option>Home</option>
            <option>Work</option>
            <option>Other</option>
          </select>
          <div className="flex gap-2 sm:col-span-2">
            <button onClick={save} className={btn.dark}>Save</button>
            <button onClick={() => setAdding(false)} className={btn.ghost}>Cancel</button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {list?.map((a) => (
          <div key={a.id} className="rounded-3xl bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-bold"><MapPin className="h-4 w-4 text-brand" /> {a.label}</span>
              {a.isDefault && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-brand">Default</span>}
            </div>
            <p className="mt-2 text-sm font-semibold">{a.name}</p>
            <p className="text-sm text-ink/70">{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} – {a.pincode}</p>
            <p className="text-sm text-ink/70">{a.phone}</p>
            <div className="mt-3 flex gap-4 text-sm font-semibold">
              {!a.isDefault && <button onClick={() => makeDefault(a.id)} className="text-accent">Make default</button>}
              <button onClick={() => remove(a.id)} className="flex items-center gap-1 text-red-600"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
            </div>
          </div>
        ))}
        {list?.length === 0 && !adding && <p className="text-sm text-muted">No saved addresses yet.</p>}
      </div>
    </div>
  );
}
