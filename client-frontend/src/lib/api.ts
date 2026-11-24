// Small fetch wrapper for the Tailskart API.
// Browser calls go to NEXT_PUBLIC_API_URL with the session cookie;
// server components may use API_INTERNAL_URL (e.g. a private load balancer address).

export const PUBLIC_API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
const SERVER_API_URL = (process.env.API_INTERNAL_URL || PUBLIC_API_URL).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
    public details?: unknown,
  ) {
    super(message);
  }
}

async function toError(res: Response) {
  let body: { error?: { message?: string; code?: string; details?: unknown } } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error */
  }
  return new ApiError(res.status, body.error?.message ?? `Request failed (${res.status})`, body.error?.code, body.error?.details);
}

/** Browser-side request (sends cookies). */
export async function api<T>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${PUBLIC_API_URL}/v1${path}`, {
      method: opts.method ?? "GET",
      credentials: "include",
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "Can't reach the store right now. Check your connection and try again.", "network");
  }
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Small per-process TTL cache for public catalog reads. (Next's fetch data cache is not used:
// it is per-instance anyway and was observed to stall cached fetches made from the root layout.)
const memo = new Map<string, { expires: number; value: Promise<unknown> }>();
const MAX_ENTRIES = 1000;

/** Browser-side multipart upload (sends cookies). */
export async function apiUpload<T>(path: string, form: FormData, method = "POST"): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${PUBLIC_API_URL}/v1${path}`, { method, credentials: "include", body: form });
  } catch {
    throw new ApiError(0, "Can't reach the store right now. Check your connection and try again.", "network");
  }
  if (!res.ok) throw await toError(res);
  return res.json() as Promise<T>;
}

/** Server-side cached GET for public catalog data. Returns null on 404. */
export async function serverGet<T>(path: string, revalidate = 60): Promise<T | null> {
  const now = Date.now();
  const hit = memo.get(path);
  if (hit && hit.expires > now) return hit.value as Promise<T | null>;

  const value = (async () => {
    const res = await fetch(`${SERVER_API_URL}/v1${path}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (res.status === 404) return null;
    if (!res.ok) throw await toError(res);
    return (await res.json()) as T;
  })();
  memo.set(path, { expires: now + revalidate * 1000, value });
  value.catch(() => memo.delete(path));
  if (memo.size > MAX_ENTRIES) {
    for (const [k, v] of memo) if (v.expires <= now || memo.size > MAX_ENTRIES) memo.delete(k);
  }
  return value;
}

/** Like serverGet but never throws — for non-critical page sections. */
export async function serverGetSafe<T>(path: string, fallback: T, revalidate = 60): Promise<T> {
  try {
    return (await serverGet<T>(path, revalidate)) ?? fallback;
  } catch {
    return fallback;
  }
}

export const qs = (params: Record<string, string | number | boolean | undefined | null | string[]>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    s.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  const str = s.toString();
  return str ? `?${str}` : "";
};

export const formatINR = (paise: number) => {
  const r = paise / 100;
  return "₹" + r.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(r) ? 0 : 2, maximumFractionDigits: 2 });
};

export const discountPct = (v: { price: number; mrp: number }) => (v.mrp > v.price ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0);

export const per100g = (v: { price: number; grams: number | null }) => (v.grams ? Math.round((v.price / v.grams) * 100) : null);
