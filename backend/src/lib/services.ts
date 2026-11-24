// External integrations: OTP delivery, media storage and Razorpay.
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { env } from "../config/env.js";
import { HttpError, logger } from "./core.js";

// ---------- OTP ----------

/** Last OTP per phone — only populated when OTP_PROVIDER=test (automated tests). */
export const testOtpOutbox = new Map<string, string>();

let sns: SNSClient | null = null;

export function generateOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function sendOtp(phone: string, code: string) {
  const text = `${code} is your Tailskart login code. It expires in ${Math.round(env.OTP_TTL_SECONDS / 60)} minutes. Do not share it with anyone.`;
  switch (env.OTP_PROVIDER) {
    case "test":
      testOtpOutbox.set(phone, code);
      return;
    case "console":
      logger.warn({ phone, code }, "OTP (console provider — development only)");
      return;
    case "sns": {
      sns ??= new SNSClient({ region: env.AWS_REGION });
      await sns.send(
        new PublishCommand({
          PhoneNumber: `+91${phone}`,
          Message: text,
          MessageAttributes: { "AWS.SNS.SMS.SMSType": { DataType: "String", StringValue: "Transactional" } },
        }),
      );
      return;
    }
  }
}

// ---------- Media storage ----------

let s3: S3Client | null = null;
const ALLOWED = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/avif", ".avif"],
]);

export function isAllowedImage(mime: string) {
  return ALLOWED.has(mime);
}

export async function storeImage(file: { buffer: Buffer; mimetype: string; originalname: string }, folder = "products") {
  const ext = ALLOWED.get(file.mimetype) ?? (extname(file.originalname).toLowerCase() || ".jpg");
  const key = `${folder}/${new Date().toISOString().slice(0, 7)}/${randomBytes(12).toString("hex")}${ext}`;
  if (env.STORAGE_DRIVER === "s3") {
    s3 ??= new S3Client({ region: env.AWS_REGION });
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return { key, url: `${env.MEDIA_CDN_URL.replace(/\/$/, "")}/${key}` };
  }
  const path = resolve(process.cwd(), "uploads", key);
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, file.buffer);
  return { key, url: `${env.PUBLIC_API_URL.replace(/\/$/, "")}/uploads/${key}` };
}

export async function deleteImage(key: string | null | undefined) {
  if (!key) return;
  try {
    if (env.STORAGE_DRIVER === "s3") {
      s3 ??= new S3Client({ region: env.AWS_REGION });
      await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    } else {
      await unlink(resolve(process.cwd(), "uploads", key));
    }
  } catch (err) {
    logger.warn({ err, key }, "Failed to delete media object");
  }
}

// ---------- Private documents (prescriptions) ----------

const PRIVATE_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/heic", ".heic"],
  ["application/pdf", ".pdf"],
]);
export const isAllowedDocument = (mime: string) => PRIVATE_TYPES.has(mime);

export async function storePrivate(file: { buffer: Buffer; mimetype: string }, folder: string) {
  const key = `${folder}/${new Date().toISOString().slice(0, 7)}/${randomBytes(16).toString("hex")}${PRIVATE_TYPES.get(file.mimetype) ?? ""}`;
  if (env.STORAGE_DRIVER === "s3") {
    s3 ??= new S3Client({ region: env.AWS_REGION });
    await s3.send(new PutObjectCommand({ Bucket: env.PRIVATE_S3_BUCKET, Key: key, Body: file.buffer, ContentType: file.mimetype, ServerSideEncryption: "AES256" }));
  } else {
    const path = resolve(process.cwd(), "private-uploads", key);
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, file.buffer);
  }
  return key;
}

export async function readPrivate(key: string): Promise<Buffer> {
  if (env.STORAGE_DRIVER === "s3") {
    s3 ??= new S3Client({ region: env.AWS_REGION });
    const r = await s3.send(new GetObjectCommand({ Bucket: env.PRIVATE_S3_BUCKET, Key: key }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  return readFile(resolve(process.cwd(), "private-uploads", key));
}

export async function deletePrivate(key: string) {
  try {
    if (env.STORAGE_DRIVER === "s3") {
      s3 ??= new S3Client({ region: env.AWS_REGION });
      await s3.send(new DeleteObjectCommand({ Bucket: env.PRIVATE_S3_BUCKET, Key: key }));
    } else await unlink(resolve(process.cwd(), "private-uploads", key));
  } catch (err) {
    logger.warn({ err, key }, "Failed to delete private object");
  }
}

// ---------- Razorpay ----------

export async function createRazorpayOrder(amountPaise: number, receipt: string) {
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt }),
  });
  if (!res.ok) {
    logger.error({ status: res.status, body: await res.text() }, "Razorpay order creation failed");
    throw new HttpError(502, "Payment gateway is unavailable. Please try again or choose cash on delivery.", "payment_gateway");
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function verifyRazorpayPayment(orderId: string, paymentId: string, signature: string) {
  const expected = createHmac("sha256", env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

export function verifyRazorpayWebhook(rawBody: Buffer, signature: string) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
