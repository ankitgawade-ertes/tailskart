import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/core.js";
import { testOtpOutbox } from "../src/lib/services.js";

const app = createApp();
const ORIGIN = "http://localhost:3000";
let variantId = "";
let cookie = "";
let adminCookie = "";
let addressId = "";

async function login(phone: string) {
  await request(app).post("/v1/auth/otp/request").set("Origin", ORIGIN).send({ phone }).expect(200);
  const code = testOtpOutbox.get(phone)!;
  const res = await request(app).post("/v1/auth/otp/verify").set("Origin", ORIGIN).send({ phone, code, name: "Test Parent" }).expect(200);
  return res.headers["set-cookie"][0].split(";")[0];
}

beforeAll(async () => {
  const cat = await prisma.category.create({ data: { slug: "dog-dry-food", name: "Dry Food", pet: "DOG", group: "Food" } });
  const p = await prisma.product.create({
    data: {
      slug: "test-kibble",
      name: "Test Kibble",
      brand: "Testco",
      pet: "DOG",
      categoryId: cat.id,
      status: "ACTIVE",
      minPrice: 50000,
      maxDiscount: 10,
      lifeStage: "Adult",
      variants: { create: [{ label: "3kg", price: 50000, mrp: 55000, grams: 3000, stock: 3 }] },
    },
    include: { variants: true },
  });
  variantId = p.variants[0].id;
  await prisma.coupon.create({ data: { code: "TEST10", type: "PERCENT", value: 10, maxDiscount: 10000 } });
  await prisma.adminUser.create({
    data: { email: "owner@test.in", name: "Owner", role: "SUPER_ADMIN", passwordHash: await bcrypt.hash("Password123", 4) },
  });
});

describe("public catalog", () => {
  it("reports health", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body.status).toBe("ok");
  });

  it("lists products with facets", async () => {
    const res = await request(app).get("/v1/products?category=dog-dry-food").expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].variants[0].price).toBe(50000);
    expect(res.body.facets.brand[0]).toEqual({ value: "Testco", count: 1 });
  });

  it("searches by keyword", async () => {
    const res = await request(app).get("/v1/products?q=kibble").expect(200);
    expect(res.body.items).toHaveLength(1);
  });

  it("returns 404 for unknown products", async () => {
    await request(app).get("/v1/products/nope").expect(404);
  });
});

describe("customer flow", () => {
  it("rejects unauthenticated order access", async () => {
    await request(app).get("/v1/orders").expect(401);
  });

  it("blocks state-changing requests from unknown origins", async () => {
    await request(app).post("/v1/auth/otp/request").set("Origin", "https://evil.example").send({ phone: "9876543210" }).expect(403);
  });

  it("logs in with OTP and rejects a wrong code", async () => {
    await request(app).post("/v1/auth/otp/request").set("Origin", ORIGIN).send({ phone: "9876543210" }).expect(200);
    await request(app).post("/v1/auth/otp/verify").set("Origin", ORIGIN).send({ phone: "9876543210", code: "000000" === testOtpOutbox.get("9876543210") ? "111111" : "000000" }).expect(400);
    cookie = await login("9876543210");
    const me = await request(app).get("/v1/auth/me").set("Cookie", cookie).expect(200);
    expect(me.body.customer.phone).toBe("9876543210");
  });

  it("saves an address", async () => {
    const res = await request(app)
      .post("/v1/me/addresses")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ name: "Test Parent", phone: "9876543210", line1: "12 Test Street", city: "Bengaluru", state: "Karnataka", pincode: "560001" })
      .expect(201);
    addressId = res.body.id;
    expect(res.body.isDefault).toBe(true);
  });

  it("prices a cart on the server with a coupon", async () => {
    const res = await request(app)
      .post("/v1/cart/quote")
      .set("Origin", ORIGIN)
      .send({ items: [{ variantId, qty: 2 }], couponCode: "test10", pincode: "560001" })
      .expect(200);
    expect(res.body.subtotal).toBe(100000);
    expect(res.body.discount).toBe(10000);
    expect(res.body.shippingFee).toBe(0);
    expect(res.body.total).toBe(90000);
    expect(res.body.delivery.sameDay).toBe(true);
  });

  it("places a COD order and reserves stock", async () => {
    const res = await request(app)
      .post("/v1/orders")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ items: [{ variantId, qty: 2 }], addressId, payment: "COD", couponCode: "TEST10" })
      .expect(201);
    expect(res.body.order.status).toBe("PLACED");
    expect(res.body.order.total).toBe(90000);
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } });
    expect(v.stock).toBe(1);
  });

  it("refuses to oversell", async () => {
    const res = await request(app)
      .post("/v1/orders")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ items: [{ variantId, qty: 2 }], addressId, payment: "COD" })
      .expect(409);
    expect(res.body.error.code).toBe("cart_changed");
  });

  it("completes an online (mock) payment", async () => {
    const res = await request(app)
      .post("/v1/orders")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ items: [{ variantId, qty: 1 }], addressId, payment: "ONLINE" })
      .expect(201);
    expect(res.body.order.status).toBe("PENDING_PAYMENT");
    expect(res.body.payment.provider).toBe("mock");
    const paid = await request(app)
      .post("/v1/payments/mock/confirm")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ orderNumber: res.body.order.number })
      .expect(200);
    expect(paid.body.status).toBe("PLACED");
    expect(paid.body.paymentStatus).toBe("PAID");
  });

  it("lets the customer cancel and restores stock", async () => {
    const list = await request(app).get("/v1/orders").set("Cookie", cookie).expect(200);
    const number = list.body.items[0].number;
    const res = await request(app).post(`/v1/orders/${number}/cancel`).set("Cookie", cookie).set("Origin", ORIGIN).expect(200);
    expect(res.body.status).toBe("CANCELLED");
    const v = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } });
    expect(v.stock).toBe(1);
  });

  it("hides another customer's orders", async () => {
    const other = await login("9123456780");
    const list = await request(app).get("/v1/orders").set("Cookie", cookie).expect(200);
    await request(app).get(`/v1/orders/${list.body.items[0].number}`).set("Cookie", other).expect(404);
  });
});

describe("admin", () => {
  it("rejects bad credentials", async () => {
    await request(app).post("/v1/admin/auth/login").set("Origin", "http://localhost:5173").send({ email: "owner@test.in", password: "wrong" }).expect(401);
  });

  it("logs in and reads the dashboard", async () => {
    const res = await request(app)
      .post("/v1/admin/auth/login")
      .set("Origin", "http://localhost:5173")
      .send({ email: "owner@test.in", password: "Password123" })
      .expect(200);
    adminCookie = res.headers["set-cookie"][0].split(";")[0];
    const dash = await request(app).get("/v1/admin/dashboard").set("Cookie", adminCookie).expect(200);
    expect(dash.body.revenue.month.orders).toBeGreaterThanOrEqual(1);
  });

  it("customer sessions can't reach admin routes", async () => {
    await request(app).get("/v1/admin/dashboard").set("Cookie", cookie).expect(401);
  });

  it("moves an order through fulfilment", async () => {
    const list = await request(app).get("/v1/admin/orders?status=PLACED").set("Cookie", adminCookie).expect(200);
    const id = list.body.items[0].id;
    for (const status of ["PACKED", "SHIPPED", "DELIVERED"]) {
      await request(app).post(`/v1/admin/orders/${id}/status`).set("Cookie", adminCookie).set("Origin", "http://localhost:5173").send({ status }).expect(200);
    }
    await request(app).post(`/v1/admin/orders/${id}/status`).set("Cookie", adminCookie).set("Origin", "http://localhost:5173").send({ status: "PACKED" }).expect(400);
    const detail = await request(app).get(`/v1/admin/orders/${id}`).set("Cookie", adminCookie).expect(200);
    expect(detail.body.status).toBe("DELIVERED");
    expect(detail.body.paymentStatus).toBe("PAID");
  });

  it("creates a product with variants", async () => {
    const cat = await prisma.category.findFirstOrThrow();
    const res = await request(app)
      .post("/v1/admin/products")
      .set("Cookie", adminCookie)
      .set("Origin", "http://localhost:5173")
      .send({
        name: "Chew Toy",
        brand: "Testco",
        pet: "dog",
        categoryId: cat.id,
        status: "ACTIVE",
        variants: [{ label: "M", price: 29900, mrp: 39900, stock: 10 }],
      })
      .expect(201);
    expect(res.body.slug).toBe("testco-chew-toy");
    const pub = await request(app).get("/v1/products/testco-chew-toy").expect(200);
    expect(pub.body.product.variants[0].price).toBe(29900);
  });
});

describe("care routes (ametad + pharko)", () => {
  const ADMIN_ORIGIN = "http://localhost:5173";
  const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");

  it("exposes branches and slots", async () => {
    const res = await request(app).get("/v1/care/config").expect(200);
    expect(res.body.branches.length).toBeGreaterThan(0);
    expect(res.body.slots.length).toBe(3);
  });

  it("books an ametad appointment and rejects past dates", async () => {
    const cfg = (await request(app).get("/v1/care/config")).body;
    const base = { name: "Test Parent", phone: "9876543210", petName: "Bruno", species: "Dog", reason: "Annual check-up", preferredSlot: cfg.slots[0], branch: cfg.branches[0] };
    await request(app).post("/v1/ametad/appointments").set("Origin", ORIGIN).send({ ...base, preferredDate: "2020-01-01" }).expect(400);
    const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    const res = await request(app).post("/v1/ametad/appointments").set("Cookie", cookie).set("Origin", ORIGIN).send({ ...base, preferredDate: tomorrow }).expect(201);
    expect(res.body.reference).toMatch(/^AM-\d+$/);
    const mine = await request(app).get("/v1/me/appointments").set("Cookie", cookie).expect(200);
    expect(mine.body.items).toHaveLength(1);
  });

  it("requires login and a valid file to upload a prescription", async () => {
    const cfg = (await request(app).get("/v1/care/config")).body;
    await request(app).post("/v1/pharko/prescriptions").set("Origin", ORIGIN).field("petName", "Bruno").field("branch", cfg.branches[0]).expect(401);
    await request(app)
      .post("/v1/pharko/prescriptions")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .field("petName", "Bruno")
      .field("branch", cfg.branches[0])
      .attach("file", Buffer.from("hello"), { filename: "x.txt", contentType: "text/plain" })
      .expect(400);
  });

  it("runs the full pharko flow: upload → needs info → re-upload → ready → collected", async () => {
    const cfg = (await request(app).get("/v1/care/config")).body;
    const up = await request(app)
      .post("/v1/pharko/prescriptions")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .field("petName", "Bruno")
      .field("branch", cfg.branches[0])
      .attach("file", png, { filename: "rx.png", contentType: "image/png" })
      .expect(201);
    expect(up.body.reference).toMatch(/^PK-\d+$/);
    expect(up.body.status).toBe("RECEIVED");
    expect(up.body).not.toHaveProperty("fileKey");

    // Not reachable publicly
    await request(app).get(`/uploads/prescriptions/x.png`).expect(404);

    const list = await request(app).get("/v1/admin/prescriptions").set("Cookie", adminCookie).expect(200);
    const id = list.body.items[0].id;
    const file = await request(app).get(`/v1/admin/prescriptions/${id}/file`).set("Cookie", adminCookie).expect(200);
    expect(file.headers["cache-control"]).toContain("no-store");
    await request(app).get(`/v1/admin/prescriptions/${id}/file`).set("Cookie", cookie).expect(401);

    const patch = (body: object) => request(app).patch(`/v1/admin/prescriptions/${id}`).set("Cookie", adminCookie).set("Origin", ADMIN_ORIGIN).send(body);
    await patch({ status: "NEEDS_INFO" }).expect(400); // note required
    await patch({ status: "NEEDS_INFO", staffNote: "Photo is blurry" }).expect(200);

    const other = await login("9123456780");
    await request(app).put(`/v1/me/prescriptions/${up.body.reference}/file`).set("Cookie", other).set("Origin", ORIGIN).attach("file", png, { filename: "rx.png", contentType: "image/png" }).expect(404);
    const mine = await request(app).get("/v1/me/prescriptions").set("Cookie", cookie).expect(200);
    expect(mine.body.items[0].staffNote).toBe("Photo is blurry");
    const re = await request(app).put(`/v1/me/prescriptions/${up.body.reference}/file`).set("Cookie", cookie).set("Origin", ORIGIN).attach("file", png, { filename: "rx2.png", contentType: "image/png" }).expect(200);
    expect(re.body.status).toBe("RECEIVED");

    await patch({ status: "COLLECTED" }).expect(400); // can't skip review
    await patch({ status: "IN_REVIEW" }).expect(200);
    const ready = await patch({ status: "READY_FOR_PICKUP" }).expect(200);
    expect(ready.body.readyAt).toBeTruthy();
    await patch({ status: "COLLECTED" }).expect(200);
  });
});
