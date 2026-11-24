import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import Header from "@/components/Header";
import Footer, { MobileTabBar } from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import { serverGetSafe } from "@/lib/api";
import type { Breed, Category } from "@/lib/types";
import { SiteProvider } from "@/components/SiteProvider";
import { getSite } from "@/lib/site";

// DM Sans (variable, 100–1000), bundled with the site so builds never depend on fetching Google Fonts.
const dmSans = localFont({ src: "./fonts/dm-sans.woff2", variable: "--font-dm-sans", weight: "100 1000", display: "swap" });

// Pages render per request against the API; fetches are cached for a short time (see lib/api.ts).
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "tailskart — Their everyday, delivered", template: "%s | Tailskart" },
  description: "Shop pet food, treats, toys, grooming and accessories for dogs, cats and small pets. Fast delivery, genuine products, easy returns.",
  icons: { icon: "/icon.svg" },
  openGraph: { type: "website", siteName: "Tailskart", locale: "en_IN" },
};

export const viewport: Viewport = { themeColor: "#2438c8" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [cats, breeds, site] = await Promise.all([
    serverGetSafe<{ items: Category[] }>("/categories", { items: [] }, 300),
    serverGetSafe<{ items: Breed[] }>("/breeds", { items: [] }, 300),
    getSite(),
  ]);
  return (
    <html lang="en" className={dmSans.variable}>
      <body className="min-h-screen">
        <SiteProvider site={site}>
        <StoreProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-white">
            Skip to content
          </a>
          <Header categories={cats.items} breeds={breeds.items} />
          <main id="main" className="min-h-[60vh]">{children}</main>
          <Footer categories={cats.items} />
          <MobileTabBar />
          <CartDrawer />
        </StoreProvider>
        </SiteProvider>
      </body>
    </html>
  );
}
