import type { Request, Response, NextFunction, CookieOptions } from "express";
import jwt from "jsonwebtoken";
import type { AdminRole } from "@prisma/client";
import { env, isProd } from "../config/env.js";
import { forbidden, prisma, unauthorized } from "./core.js";

export const CUSTOMER_COOKIE = "tk_session";
export const ADMIN_COOKIE = "tk_admin";
const CUSTOMER_TTL_DAYS = 30;
const ADMIN_TTL_HOURS = 12;

interface CustomerClaims {
  sub: string;
  typ: "customer";
}
interface AdminClaims {
  sub: string;
  typ: "admin";
  role: AdminRole;
}

declare module "express-serve-static-core" {
  interface Request {
    customerId?: string;
    admin?: { id: string; role: AdminRole; email: string; name: string };
  }
}

function cookieOpts(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeMs,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function issueCustomerSession(res: Response, customerId: string) {
  const token = jwt.sign({ sub: customerId, typ: "customer" } satisfies CustomerClaims, env.JWT_SECRET, {
    expiresIn: `${CUSTOMER_TTL_DAYS}d`,
    audience: "tailskart-store",
  });
  res.cookie(CUSTOMER_COOKIE, token, cookieOpts(CUSTOMER_TTL_DAYS * 864e5));
}

export function issueAdminSession(res: Response, admin: { id: string; role: AdminRole }) {
  const token = jwt.sign({ sub: admin.id, typ: "admin", role: admin.role } satisfies AdminClaims, env.ADMIN_JWT_SECRET, {
    expiresIn: `${ADMIN_TTL_HOURS}h`,
    audience: "tailskart-admin",
  });
  res.cookie(ADMIN_COOKIE, token, cookieOpts(ADMIN_TTL_HOURS * 36e5));
}

export function clearSession(res: Response, name: string) {
  const { maxAge: _m, ...opts } = cookieOpts(0);
  res.clearCookie(name, opts);
}

function readCustomer(req: Request): string | null {
  const token = req.cookies?.[CUSTOMER_COOKIE];
  if (!token) return null;
  try {
    const c = jwt.verify(token, env.JWT_SECRET, { audience: "tailskart-store" }) as CustomerClaims;
    return c.typ === "customer" ? c.sub : null;
  } catch {
    return null;
  }
}

/** Attaches req.customerId when a valid session exists; never fails. */
export function optionalCustomer(req: Request, _res: Response, next: NextFunction) {
  req.customerId = readCustomer(req) ?? undefined;
  next();
}

export async function requireCustomer(req: Request, _res: Response, next: NextFunction) {
  const id = readCustomer(req);
  if (!id) throw unauthorized();
  const c = await prisma.customer.findUnique({ where: { id }, select: { id: true, isBlocked: true } });
  if (!c) throw unauthorized();
  if (c.isBlocked) throw forbidden("Your account has been suspended. Please contact support.");
  req.customerId = c.id;
  next();
}

const RANK: Record<AdminRole, number> = { STAFF: 1, ADMIN: 2, SUPER_ADMIN: 3 };

export function requireAdmin(minRole: AdminRole = "STAFF") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.[ADMIN_COOKIE];
    if (!token) throw unauthorized();
    let claims: AdminClaims;
    try {
      claims = jwt.verify(token, env.ADMIN_JWT_SECRET, { audience: "tailskart-admin" }) as AdminClaims;
    } catch {
      throw unauthorized("Your session has expired. Please log in again.");
    }
    const admin = await prisma.adminUser.findUnique({ where: { id: claims.sub } });
    if (!admin || !admin.isActive) throw unauthorized();
    if (RANK[admin.role] < RANK[minRole]) throw forbidden();
    req.admin = { id: admin.id, role: admin.role, email: admin.email, name: admin.name };
    next();
  };
}
