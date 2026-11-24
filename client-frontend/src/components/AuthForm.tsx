"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ShieldCheck, Gift, Truck } from "lucide-react";
import { Logo, btn, input } from "./ui";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import type { Customer } from "@/lib/types";
import { PAGE_PHOTOS } from "@/data/images";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const rawNext = useSearchParams().get("next") ?? "/account";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/account";
  const { setUser, showToast } = useStore();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [err, setErr] = useState("");
  const [timer, setTimer] = useState(30);
  const [busy, setBusy] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step !== "otp" || timer === 0) return;
    const t = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(t);
  }, [step, timer]);

  const send = async () => {
    if (mode === "signup" && !name.trim()) return setErr("Please enter your name");
    if (!/^[6-9]\d{9}$/.test(phone)) return setErr("Enter a valid 10-digit mobile number");
    setErr("");
    setBusy(true);
    try {
      await api("/auth/otp/request", { method: "POST", body: { phone } });
      setOtp(["", "", "", "", "", ""]);
      setStep("otp");
      setTimer(30);
      setTimeout(() => refs.current[0]?.focus(), 50);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const code = otp.join("");
    if (code.length < 6) return setErr("Enter the 6-digit code");
    setErr("");
    setBusy(true);
    try {
      const r = await api<{ customer: Customer; isNew: boolean }>("/auth/otp/verify", {
        method: "POST",
        body: { phone, code, ...(name.trim() ? { name: name.trim() } : {}), ...(email.trim() ? { email: email.trim() } : {}) },
      });
      setUser(r.customer);
      showToast(r.isNew ? "Welcome to Tailskart!" : "Logged in");
      router.replace(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setDigit = (i: number, val: string) => {
    const d = val.replace(/\D/g, "");
    if (d.length > 1) {
      const arr = d.slice(0, 6).split("");
      setOtp([...arr, ...Array(6 - arr.length).fill("")]);
      refs.current[Math.min(arr.length, 5)]?.focus();
      return;
    }
    const nextOtp = [...otp];
    nextOtp[i] = d;
    setOtp(nextOtp);
    if (d && i < 5) refs.current[i + 1]?.focus();
  };

  return (
    <div className="container-x grid min-h-[70vh] items-center gap-10 py-10 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden rounded-[36px] bg-brand p-12 text-white lg:block">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-fold">Members get more</p>
        <h2 className="mt-3 font-display text-4xl font-semibold leading-tight">Join pet parents who shop smarter</h2>
        <ul className="mt-8 space-y-4">
          {[
            [Gift, "Member-only offers"],
            [Truck, "Faster checkout & order tracking"],
            [ShieldCheck, "Saved addresses and wishlist"],
          ].map(([Icon, t]) => {
            const I = Icon as typeof Gift;
            return (
              <li key={t as string} className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><I className="h-5 w-5 text-fold" /></span>
                {t as string}
              </li>
            );
          })}
        </ul>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PAGE_PHOTOS.login} alt="" className="absolute bottom-0 right-0 h-1/2 w-full object-cover opacity-90 [mask-image:linear-gradient(to_bottom,transparent,black_45%)]" />
      </div>

      <div className="mx-auto w-full max-w-md">
        <div className="rounded-[32px] bg-white p-7 shadow-soft md:p-9">
          <Logo className="text-3xl" />
          {step === "phone" ? (
            <>
              <h1 className="mt-6 font-display text-3xl font-semibold text-brand">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
              <p className="mt-1 text-sm text-muted">{mode === "signup" ? "Sign up with your mobile number — no password needed." : "Log in with your mobile number. We’ll send you a one-time code."}</p>
              <div className="mt-6 space-y-3">
                {mode === "signup" && (
                  <>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={input} autoComplete="name" />
                    <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" type="email" className={input} autoComplete="email" />
                  </>
                )}
                <div className="flex gap-2">
                  <span className="flex items-center rounded-xl border border-line bg-cream px-3 text-sm font-semibold">🇮🇳 +91</span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder="Mobile number"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    className={input}
                  />
                </div>
                {err && <p className="text-sm text-red-600">{err}</p>}
                <button onClick={send} disabled={busy} className={`${btn.primary} w-full`}>{busy ? "Sending…" : "Get OTP"} <ArrowRight className="h-4 w-4" /></button>
              </div>
              <p className="mt-6 text-center text-sm text-muted">
                {mode === "signup" ? (
                  <>Already have an account? <Link href="/login" className="font-bold text-accent">Log in</Link></>
                ) : (
                  <>New to Tailskart? <Link href="/signup" className="font-bold text-accent">Create an account</Link></>
                )}
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-6 font-display text-3xl font-semibold text-brand">Enter the code</h1>
              <p className="mt-1 text-sm text-muted">
                Sent to +91 {phone}.{" "}
                <button onClick={() => setStep("phone")} className="font-bold text-accent">Change</button>
              </p>
              <div className="mt-6 flex justify-between gap-2">
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { refs.current[i] = el; }}
                    value={d}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !otp[i] && i > 0) refs.current[i - 1]?.focus();
                      if (e.key === "Enter") verify();
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    aria-label={`Digit ${i + 1}`}
                    className="h-14 w-full rounded-xl border border-line bg-white text-center text-xl font-bold outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
                  />
                ))}
              </div>
              {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
              <button onClick={verify} disabled={busy} className={`${btn.primary} mt-5 w-full`}>{busy ? "Verifying…" : "Verify & continue"}</button>
              <p className="mt-4 text-center text-sm text-muted">
                {timer > 0 ? <>Resend code in 0:{String(timer).padStart(2, "0")}</> : <button onClick={send} className="font-bold text-accent">Resend code</button>}
              </p>
            </>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          By continuing you agree to our <Link href="/policies/terms" className="underline">Terms</Link> and <Link href="/policies/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
