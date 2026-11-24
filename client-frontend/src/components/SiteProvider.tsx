"use client";

import { createContext, useContext } from "react";
import { DEFAULT_SITE, type Site } from "@/lib/site";

const SiteContext = createContext<Site>(DEFAULT_SITE);

export function SiteProvider({ site, children }: { site: Site; children: React.ReactNode }) {
  return <SiteContext.Provider value={site}>{children}</SiteContext.Provider>;
}

/** Store details from Admin → Settings (falls back to the built-in defaults). */
export const useSite = () => useContext(SiteContext);
