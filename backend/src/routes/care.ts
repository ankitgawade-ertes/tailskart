// Customer routes for the two care destinations hosted on Tailskart:
//   ametad — veterinary hospital: appointment requests (confirmed by Ametad staff)
//   pharko — veterinary pharmacy: prescription upload, review status, counter pickup
import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { AppointmentRequest, PrescriptionRequest } from "@prisma/client";
import { isTest } from "../config/env.js";
import { getSettings } from "../lib/settings.js";
import { badRequest, notFound, prisma } from "../lib/core.js";
import { parse } from "../lib/http.js";
import { optionalCustomer, requireCustomer } from "../lib/auth.js";
import { deletePrivate, isAllowedDocument, storePrivate } from "../lib/services.js";

export const care = Router();

export const SLOTS = ["Morning (9am–12pm)", "Afternoon (12pm–4pm)", "Evening (4pm–8pm)"];
export const appointmentRef = (seq: number) => `AM-${1000 + seq}`;
export const prescriptionRef = (seq: number) => `PK-${1000 + seq}`;
const parseRef = (ref: string, prefix: string) => {
  const m = new RegExp(`^${prefix}-(\\d{4,})$`, "i").exec(ref.trim());
  return m ? Number(m[1]) - 1000 : null;
};

const careLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: isTest ? 1000 : 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many requests. Please try again in a few minutes." } },
});

export const appointmentOut = (a: AppointmentRequest) => ({
  id: a.id,
  reference: appointmentRef(a.seq),
  petName: a.petName,
  species: a.species,
  reason: a.reason,
  preferredDate: a.preferredDate,
  preferredSlot: a.preferredSlot,
  branch: a.branch,
  status: a.status,
  staffNote: a.staffNote,
  createdAt: a.createdAt,
});

/** What the customer sees — never exposes the storage key. */
export const prescriptionOut = (p: PrescriptionRequest) => ({
  id: p.id,
  reference: prescriptionRef(p.seq),
  petName: p.petName,
  branch: p.branch,
  note: p.note,
  fileName: p.fileName,
  status: p.status,
  staffNote: p.status === "NEEDS_INFO" || p.status === "REJECTED" ? p.staffNote : null,
  readyAt: p.readyAt,
  collectedAt: p.collectedAt,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

care.get("/care/config", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=60").json({ branches: (await getSettings()).branches, slots: SLOTS });
});

// ---------- ametad ----------

care.post("/ametad/appointments", careLimiter, optionalCustomer, async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = parse(
    z.object({
      name: z.string().trim().min(1, "Please enter your name").max(80),
      phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
      email: z.string().trim().email().max(120).optional().or(z.literal("")),
      petName: z.string().trim().min(1, "Please enter your pet's name").max(60),
      species: z.enum(["Dog", "Cat", "Rabbit", "Bird", "Fish", "Other"]),
      reason: z.string().trim().min(3, "Tell us briefly why you're visiting").max(500),
      preferredDate: z.coerce
        .date()
        .refine((v) => v >= today, "Choose today or a later date")
        .refine((v) => v.getTime() < today.getTime() + 60 * 864e5, "Choose a date within the next 60 days"),
      preferredSlot: z.enum(SLOTS as [string, ...string[]]),
      branch: z.string().trim().min(1, "Choose a branch"),
    }),
    req.body,
  );
  if (!(await getSettings()).branches.includes(d.branch)) throw badRequest("Choose a branch");
  const a = await prisma.appointmentRequest.create({ data: { ...d, email: d.email || null, customerId: req.customerId ?? null } });
  res.status(201).json(appointmentOut(a));
});

care.get("/me/appointments", requireCustomer, async (req, res) => {
  const items = await prisma.appointmentRequest.findMany({ where: { customerId: req.customerId }, orderBy: { createdAt: "desc" }, take: 50 });
  res.json({ items: items.map(appointmentOut) });
});

care.post("/me/appointments/:ref/cancel", requireCustomer, async (req, res) => {
  const seq = parseRef(String(req.params.ref), "AM");
  if (seq === null) throw notFound("Appointment not found");
  const r = await prisma.appointmentRequest.updateMany({
    where: { seq, customerId: req.customerId, status: { in: ["REQUESTED", "CONFIRMED"] } },
    data: { status: "CANCELLED" },
  });
  if (!r.count) throw badRequest("This appointment can't be cancelled online. Please call the hospital.");
  res.json({ ok: true });
});

// ---------- pharko ----------

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });
const prescriptionFields = z.object({
  petName: z.string().trim().min(1, "Please enter your pet's name").max(60),
  branch: z.string().trim().min(1, "Choose a pickup branch"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

function checkFile(file: Express.Multer.File | undefined) {
  if (!file) throw badRequest("Please add a photo or PDF of the prescription", "file_required");
  if (!isAllowedDocument(file.mimetype)) throw badRequest("Upload a JPG, PNG, WebP, HEIC photo or a PDF", "bad_file_type");
  return file;
}

care.post("/pharko/prescriptions", careLimiter, requireCustomer, upload.single("file"), async (req, res) => {
  const d = parse(prescriptionFields, req.body);
  if (!(await getSettings()).branches.includes(d.branch)) throw badRequest("Choose a pickup branch");
  const file = checkFile(req.file);
  const open = await prisma.prescriptionRequest.count({
    where: { customerId: req.customerId, status: { in: ["RECEIVED", "IN_REVIEW", "NEEDS_INFO"] } },
  });
  if (open >= 10) throw badRequest("You have several prescriptions under review. Please wait for an update or contact the counter.");
  const key = await storePrivate(file, "prescriptions");
  const p = await prisma.prescriptionRequest.create({
    data: {
      customerId: req.customerId!,
      petName: d.petName,
      branch: d.branch,
      note: d.note || null,
      fileKey: key,
      fileName: file.originalname.slice(0, 120),
      fileMime: file.mimetype,
      fileSize: file.size,
    },
  });
  res.status(201).json(prescriptionOut(p));
});

care.get("/me/prescriptions", requireCustomer, async (req, res) => {
  const items = await prisma.prescriptionRequest.findMany({ where: { customerId: req.customerId }, orderBy: { createdAt: "desc" }, take: 50 });
  res.json({ items: items.map(prescriptionOut) });
});

/** Replace an unreadable image when the pharmacist asked for more information. */
care.put("/me/prescriptions/:ref/file", careLimiter, requireCustomer, upload.single("file"), async (req, res) => {
  const seq = parseRef(String(req.params.ref), "PK");
  if (seq === null) throw notFound("Prescription not found");
  const existing = await prisma.prescriptionRequest.findUnique({ where: { seq } });
  if (!existing || existing.customerId !== req.customerId) throw notFound("Prescription not found");
  if (existing.status !== "NEEDS_INFO") throw badRequest("This prescription isn't waiting for a new file");
  const file = checkFile(req.file);
  const key = await storePrivate(file, "prescriptions");
  const p = await prisma.prescriptionRequest.update({
    where: { id: existing.id },
    data: { fileKey: key, fileName: file.originalname.slice(0, 120), fileMime: file.mimetype, fileSize: file.size, status: "RECEIVED", staffNote: null },
  });
  await deletePrivate(existing.fileKey);
  res.json(prescriptionOut(p));
});
