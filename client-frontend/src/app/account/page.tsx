"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Package, Plus, X } from "lucide-react";
import { btn, input } from "@/components/ui";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { Customer, Order, PetProfile } from "@/lib/types";
import { STATUS_LABEL } from "@/lib/orderStatus";


export default function AccountPage() {
  const { user, setUser, showToast } = useStore();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [summary, setSummary] = useState<{ orders: number; pets: number; wishlist: number } | null>(null);
  const [latest, setLatest] = useState<Order | null>(null);
  const [adding, setAdding] = useState(false);
  const [pet, setPet] = useState({ name: "", type: "Dog" as PetProfile["type"], breed: "", birthday: "" });
  const [err, setErr] = useState("");

  useEffect(() => {
    api<{ items: PetProfile[] }>("/me/pets").then((r) => setPets(r.items)).catch(() => {});
    api<{ orders: number; pets: number; wishlist: number }>("/me/summary").then(setSummary).catch(() => {});
    api<{ items: Order[] }>("/orders").then((r) => setLatest(r.items[0] ?? null)).catch(() => {});
  }, []);

  if (!user) return null;

  const saveProfile = async () => {
    setErr("");
    try {
      const r = await api<{ customer: Customer }>("/me", { method: "PATCH", body: { name: name.trim() || undefined, email: email.trim() } });
      setUser(r.customer);
      showToast("Profile saved");
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const addPet = async () => {
    if (!pet.name.trim()) return;
    try {
      const p = await api<PetProfile>("/me/pets", { method: "POST", body: { ...pet, breed: pet.breed || null, birthday: pet.birthday || null } });
      setPets((prev) => [...prev, p]);
      setPet({ name: "", type: "Dog", breed: "", birthday: "" });
      setAdding(false);
    } catch (e) {
      showToast((e as Error).message);
    }
  };

  const removePet = async (id: string) => {
    await api(`/me/pets/${id}`, { method: "DELETE" }).catch(() => {});
    setPets((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Orders", summary?.orders ?? "—", "/account/orders"],
          ["Pets", pets.length, "#pets"],
          ["Wishlist", summary?.wishlist ?? "—", "/wishlist"],
        ].map(([l, v, href]) => (
          <Link key={l as string} href={href as string} className="rounded-3xl bg-white p-5 shadow-soft transition hover:shadow-lift">
            <p className="text-sm text-muted">{l}</p>
            <p className="font-display text-3xl font-semibold text-brand">{v}</p>
          </Link>
        ))}
      </section>

      {latest && (
        <section className="flex flex-wrap items-center gap-4 rounded-3xl bg-white p-5 shadow-soft">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft"><Package className="h-6 w-6 text-brand" /></span>
          <div className="flex-1">
            <p className="text-sm text-muted">Latest order</p>
            <p className="font-bold">#{latest.number} · <span className="text-accent">{STATUS_LABEL[latest.status]}</span></p>
          </div>
          <Link href={`/account/orders/${latest.number}`} className={btn.ghost}>Track</Link>
        </section>
      )}

      <section className="rounded-3xl bg-white p-6 shadow-soft">
        <h2 className="font-display text-xl font-semibold text-brand">Profile</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label><span className="mb-1 block text-xs font-semibold text-muted">Full name</span><input value={name} onChange={(e) => setName(e.target.value)} className={input} autoComplete="name" /></label>
          <label><span className="mb-1 block text-xs font-semibold text-muted">Email</span><input value={email} onChange={(e) => setEmail(e.target.value)} className={input} type="email" autoComplete="email" /></label>
          <label><span className="mb-1 block text-xs font-semibold text-muted">Mobile</span><input value={`+91 ${user.phone}`} disabled className={`${input} bg-cream`} /></label>
        </div>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        <button onClick={saveProfile} className={`${btn.dark} mt-5`}>Save changes</button>
      </section>

      <section id="pets" className="rounded-3xl bg-white p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-brand">My pets</h2>
          {!adding && <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-sm font-bold text-accent"><Plus className="h-4 w-4" /> Add pet</button>}
        </div>
        <p className="mt-1 text-sm text-muted">Tell us about your pets for better recommendations.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {pets.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-cream p-4">
              <span className="text-3xl">{p.type === "Dog" ? "🐕" : p.type === "Cat" ? "🐈" : "🐾"}</span>
              <span className="flex-1">
                <span className="block font-bold">{p.name}</span>
                <span className="text-xs text-muted">
                  {p.breed || p.type}
                  {p.birthday ? ` · Born ${new Date(p.birthday).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}` : ""}
                </span>
              </span>
              <button onClick={() => removePet(p.id)} aria-label={`Remove ${p.name}`}><X className="h-4 w-4 text-muted" /></button>
            </div>
          ))}
          {pets.length === 0 && !adding && <p className="text-sm text-muted">No pets added yet.</p>}
        </div>
        {adding && (
          <div className="mt-4 grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-2">
            <input value={pet.name} onChange={(e) => setPet({ ...pet, name: e.target.value })} placeholder="Pet's name" className={input} />
            <select value={pet.type} onChange={(e) => setPet({ ...pet, type: e.target.value as PetProfile["type"] })} className={input}>
              <option>Dog</option>
              <option>Cat</option>
              <option>Other</option>
            </select>
            <input value={pet.breed} onChange={(e) => setPet({ ...pet, breed: e.target.value })} placeholder="Breed" className={input} />
            <input value={pet.birthday} onChange={(e) => setPet({ ...pet, birthday: e.target.value })} type="date" className={input} aria-label="Birthday" />
            <div className="flex gap-2 sm:col-span-2">
              <button onClick={addPet} className={btn.dark}>Save pet</button>
              <button onClick={() => setAdding(false)} className={btn.ghost}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
