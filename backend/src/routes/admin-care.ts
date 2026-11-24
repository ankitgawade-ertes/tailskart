import { Router } from "express";
import type { AppointmentStatus, Prisma, PrescriptionStatus } from "@prisma/client";
import { z } from "zod";
import { badRequest, logger, notFound, prisma } from "../lib/core.js";
import { pageParams, parse } from "../lib/http.js";
import { readPrivate } from "../lib/services.js";
import { appointmentOut, prescriptionOut, prescriptionRef } from "./care.js";

export const adminCare = Router();

// ---------- ametad appointment requests ----------

adminCare.get("/appointments", async (req, res) => {
  const q = req.query as Record<string, string>;
  const { page, limit, skip } = pageParams(q, 100);
  const where: Prisma.AppointmentRequestWhereInput = {
    ...(q.status ? { status: q.status as AppointmentStatus } : {}),
    ...(q.q ? { OR: [{ phone: { contains: q.q } }, { name: { contains: q.q, mode: "insensitive" } }, { petName: { contains: q.q, mode: "insensitive" } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.appointmentRequest.findMany({ where, orderBy: [{ preferredDate: "asc" }, { createdAt: "asc" }], skip, take: limit }),
    prisma.appointmentRequest.count({ where }),
  ]);
  res.json({ items: items.map((a) => ({ ...appointmentOut(a), name: a.name, phone: a.phone, email: a.email })), total, page, limit });
});

adminCare.patch("/appointments/:id", async (req, res) => {
  const d = parse(z.object({ status: z.enum(["REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED"]), staffNote: z.string().trim().max(500).optional().nullable() }), req.body);
  const a = await prisma.appointmentRequest.update({ where: { id: String(req.params.id) }, data: { status: d.status, staffNote: d.staffNote ?? undefined } });
  res.json(appointmentOut(a));
});

// ---------- pharko prescriptions ----------

const NEXT: Record<PrescriptionStatus, PrescriptionStatus[]> = {
  RECEIVED: ["IN_REVIEW", "NEEDS_INFO", "REJECTED"],
  IN_REVIEW: ["READY_FOR_PICKUP", "NEEDS_INFO", "REJECTED"],
  NEEDS_INFO: ["IN_REVIEW", "REJECTED"],
  READY_FOR_PICKUP: ["COLLECTED"],
  COLLECTED: [],
  REJECTED: [],
};

adminCare.get("/prescriptions", async (req, res) => {
  const q = req.query as Record<string, string>;
  const { page, limit, skip } = pageParams(q, 100);
  const seq = q.q && /^PK-\d+$/i.test(q.q.trim()) ? Number(q.q.trim().slice(3)) - 1000 : null;
  const where: Prisma.PrescriptionRequestWhereInput = {
    ...(q.status ? { status: q.status as PrescriptionStatus } : {}),
    ...(q.q ? (seq !== null ? { seq } : { customer: { OR: [{ phone: { contains: q.q } }, { name: { contains: q.q, mode: "insensitive" } }] } }) : {}),
  };
  const [items, total] = await Promise.all([
    prisma.prescriptionRequest.findMany({ where, orderBy: { createdAt: "asc" }, skip, take: limit, include: { customer: { select: { id: true, name: true, phone: true } } } }),
    prisma.prescriptionRequest.count({ where }),
  ]);
  res.json({
    items: items.map((p) => ({ ...prescriptionOut(p), staffNote: p.staffNote, customer: p.customer, nextStatuses: NEXT[p.status] })),
    total,
    page,
    limit,
  });
});

/** Streams the prescription file to signed-in staff only; never cached. */
adminCare.get("/prescriptions/:id/file", async (req, res) => {
  const p = await prisma.prescriptionRequest.findUnique({ where: { id: String(req.params.id) } });
  if (!p) throw notFound("Prescription not found");
  const buf = await readPrivate(p.fileKey);
  logger.info({ prescription: prescriptionRef(p.seq), admin: req.admin?.email }, "Prescription file viewed");
  res.set({
    "Content-Type": p.fileMime,
    "Content-Disposition": `inline; filename="${prescriptionRef(p.seq)}${p.fileName.includes(".") ? p.fileName.slice(p.fileName.lastIndexOf(".")) : ""}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.send(buf);
});

adminCare.patch("/prescriptions/:id", async (req, res) => {
  const d = parse(
    z.object({
      status: z.enum(["RECEIVED", "IN_REVIEW", "NEEDS_INFO", "READY_FOR_PICKUP", "COLLECTED", "REJECTED"]),
      staffNote: z.string().trim().max(500).optional().nullable(),
    }),
    req.body,
  );
  const p = await prisma.prescriptionRequest.findUnique({ where: { id: String(req.params.id) } });
  if (!p) throw notFound("Prescription not found");
  if (!NEXT[p.status].includes(d.status)) throw badRequest(`Can't move from ${p.status} to ${d.status}`);
  if ((d.status === "NEEDS_INFO" || d.status === "REJECTED") && !d.staffNote) throw badRequest("Add a note telling the customer what's needed");
  const updated = await prisma.prescriptionRequest.update({
    where: { id: p.id },
    data: {
      status: d.status,
      staffNote: d.staffNote ?? p.staffNote,
      ...(d.status === "READY_FOR_PICKUP" ? { readyAt: new Date() } : {}),
      ...(d.status === "COLLECTED" ? { collectedAt: new Date() } : {}),
    },
  });
  res.json({ ...prescriptionOut(updated), staffNote: updated.staffNote, nextStatuses: NEXT[updated.status] });
});
