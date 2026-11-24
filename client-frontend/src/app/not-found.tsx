import Link from "next/link";
import { btn } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="container-x py-16 text-center md:py-24">
      <p className="text-[110px] leading-none">🐕</p>
      <p className="mt-4 font-display text-6xl font-semibold text-brand">404</p>
      <h1 className="mt-2 font-display text-2xl text-brand">Oops — this page ran off to chase a squirrel</h1>
      <p className="mx-auto mt-2 max-w-md text-muted">The page you’re looking for doesn’t exist or has moved. Let’s get you back on the trail.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={btn.primary}>Go home</Link>
        <Link href="/offers" className={btn.ghost}>See today’s deals</Link>
      </div>
    </div>
  );
}
