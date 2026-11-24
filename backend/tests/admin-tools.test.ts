import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/core.js";
import { testOtpOutbox } from "../src/lib/services.js";
import { clearSettingsCache } from "../src/lib/settings.js";

// Admin upgrades: variants/options, import/export, bulk edits, inventory, settings,
// smarter coupons, loyalty points, GST invoices, reports, search, notifications, pages.

const app = createApp();
const STORE = "http://localhost:3000";
const ADMIN = "http://localhost:5173";
let admin = "";
let customer = "";
let customerId = "";
let addressId = "";
let catId = "";
let foodId = "";
let food1kg = "";
let food3kg = "";
let treatVariant = "";

const a = () => ({ get: (u: string) => request(app).get(`/v1/admin${u}`).set("Cookie", admin), send: (m: "post" | "put" | "patch", u: string, body: unknown) => request(app)[m](`/v1/admin${u}`).set("Cookie", admin).set("Origin", ADMIN).send(body as object) });

beforeAll(async () => {
  await prisma.adminUser.create({ data: { email: "tools@test.in", name: "Tools", role: "SUPER_ADMIN", passwordHash: await bcrypt.hash("Password123", 4) } });
  const res = await request(app).post("/v1/admin/auth/login").set("Origin", ADMIN).send({ email: "tools@test.in", password: "Password123" }).expect(200);
  admin = res.headers["set-cookie"][0].split(";")[0];

  const cat = await prisma.category.create({ data: { slug: "tools-cat-food", name: "Cat Food", pet: "CAT", group: "Food" } });
  catId = cat.id;
  const treats = await prisma.category.create({ data: { slug: "tools-cat-treats", name: "Cat Treats", pet: "CAT", group: "Treats" } });
  const t = await prisma.product.create({
    data: {
      slug: "tools-tuna-treat",
      name: "Tuna Treat",
      brand: "Purrfect",
      pet: "CAT",
      categoryId: treats.id,
      status: "ACTIVE",
      minPrice: 10000,
      variants: { create: [{ label: "60 g", price: 10000, mrp: 12000, stock: 50 }] },
    },
    include: { variants: true },
  });
  treatVariant = t.variants[0].id;

  const phone = "9811122233";
  await request(app).post("/v1/auth/otp/request").set("Origin", STORE).send({ phone }).expect(200);
  const v = await request(app).post("/v1/auth/otp/verify").set("Origin", STORE).send({ phone, code: testOtpOutbox.get(phone), name: "Tools Parent" }).expect(200);
  customer = v.headers["set-cookie"][0].split(";")[0];
  customerId = (await prisma.customer.findUniqueOrThrow({ where: { phone } })).id;
  const addr = await request(app)
    .post("/v1/me/addresses")
    .set("Cookie", customer)
    .set("Origin", STORE)
    .send({ name: "Tools Parent", phone, line1: "1 Test Road", city: "Mumbai", state: "Maharashtra", pincode: "400001" })
    .expect(201);
  addressId = addr.body.id;
});

describe("product options and variant grid", () => {
  it("saves options, per-variant barcode, photo and low-stock level, and logs opening stock", async () => {
    const res = await a()
      .send("post", "/products", {
        name: "Ocean Fish Dry Food",
        brand: "Purrfect",
        pet: "cat",
        categoryId: catId,
        status: "ACTIVE",
        hsn: "2309",
        gstRate: 18,
        videoUrl: "https://example.com/video.mp4",
        options: [{ name: "Size", values: ["1 kg", "3 kg"] }],
        variants: [
          { label: "1 kg", options: { Size: "1 kg" }, price: 40000, mrp: 45000, stock: 10, barcode: "8900000000011", lowStockAt: 3, imageUrl: "https://example.com/1kg.jpg" },
          { label: "3 kg", options: { Size: "3 kg" }, price: 100000, mrp: 110000, stock: 4, sku: "PF-OF-3", lowStockAt: 5 },
        ],
      })
      .expect(201);
    foodId = res.body.id;
    food1kg = res.body.variants[0].id;
    food3kg = res.body.variants[1].id;
    expect(res.body.options).toEqual([{ name: "Size", values: ["1 kg", "3 kg"] }]);
    expect(res.body.variants[0]).toMatchObject({ barcode: "8900000000011", lowStockAt: 3, options: { Size: "1 kg" } });
    expect(res.body.gstRate).toBe(18);
    const moves = await a().get(`/inventory/${food1kg}/movements`).expect(200);
    expect(moves.body.items[0]).toMatchObject({ delta: 10, balance: 10, reason: "EDIT" });
  });

  it("finds a product by barcode", async () => {
    const res = await a().get("/products?q=8900000000011").expect(200);
    expect(res.body.items.map((p: { id: string }) => p.id)).toContain(foodId);
  });
});

describe("inventory", () => {
  it("restocks, logs the change and flags low stock", async () => {
    await a().send("post", `/inventory/${food3kg}/adjust`, { mode: "add", qty: 6, reason: "RESTOCK", note: "Invoice 42" }).expect(200);
    const moves = await a().get(`/inventory/${food3kg}/movements`).expect(200);
    expect(moves.body.items[0]).toMatchObject({ delta: 6, balance: 10, reason: "RESTOCK", note: "Invoice 42" });
    await a().send("post", `/inventory/${food3kg}/adjust`, { mode: "set", qty: 2, reason: "ADJUST" }).expect(200);
    const low = await a().get("/inventory?filter=low&q=Ocean").expect(200);
    expect(low.body.items.map((r: { variantId: string }) => r.variantId)).toContain(food3kg);
    await a().send("patch", `/inventory/${food3kg}`, { location: "B2", lowStockAt: 1 }).expect(200);
    const after = await a().get("/inventory?q=PF-OF-3").expect(200);
    expect(after.body.items[0]).toMatchObject({ location: "B2", status: "ok", available: 2 });
  });
});

describe("settings", () => {
  it("drive delivery fees and COD in the cart quote", async () => {
    const current = (await a().get("/settings").expect(200)).body;
    await a().send("put", "/settings", { ...current, shipping: { freeShippingMin: 1_000_000, shippingFee: 7900, expressFee: 4900 }, cod: { enabled: false, min: 0, max: 0 } }).expect(200);
    const q = await request(app).post("/v1/cart/quote").set("Origin", STORE).send({ items: [{ variantId: treatVariant, qty: 1 }] }).expect(200);
    expect(q.body.shippingFee).toBe(7900);
    expect(q.body.cod.available).toBe(false);
    const pub = await request(app).get("/v1/settings").expect(200);
    expect(pub.body.shipping.shippingFee).toBe(7900);
    expect(pub.body.store.gstin).toBeDefined();
    await a().send("put", "/settings", current).expect(200);
    clearSettingsCache();
  });

  it("rejects invalid settings", async () => {
    await a().send("put", "/settings", { loyalty: { maxRedeemPercent: 500 } }).expect(400);
  });
});

describe("coupons", () => {
  it("applies Buy 2 Get 1 only to the chosen category, cheapest item free", async () => {
    const treatsCat = await prisma.category.findUniqueOrThrow({ where: { slug: "tools-cat-treats" } });
    await a().send("post", "/coupons", { code: "TREAT3", type: "BXGY", buyQty: 2, getQty: 1, scope: "CATEGORY", scopeIds: [treatsCat.id], isPublic: false, badgeText: "Buy 2 Get 1" }).expect(201);
    const quote = (items: { variantId: string; qty: number }[]) => request(app).post("/v1/cart/quote").set("Origin", STORE).send({ items, couponCode: "TREAT3" }).expect(200);
    const two = await quote([{ variantId: treatVariant, qty: 2 }, { variantId: food1kg, qty: 1 }]);
    expect(two.body.couponError).toMatch(/1 more eligible/);
    const three = await quote([{ variantId: treatVariant, qty: 3 }, { variantId: food1kg, qty: 1 }]);
    expect(three.body.discount).toBe(10000);
    const hidden = await request(app).get("/v1/coupons").expect(200);
    expect(hidden.body.items.map((c: { code: string }) => c.code)).not.toContain("TREAT3");
  });

  it("brand-scoped percentage coupons only discount that brand", async () => {
    await a().send("post", "/coupons", { code: "PURR10", type: "PERCENT", value: 10, scope: "BRAND", scopeIds: ["purrfect"] }).expect(201);
    await a().send("post", "/coupons", { code: "NOPE10", type: "PERCENT", value: 10, scope: "BRAND", scopeIds: ["Nobody"] }).expect(201);
    const ok = await request(app).post("/v1/cart/quote").set("Origin", STORE).send({ items: [{ variantId: food1kg, qty: 1 }], couponCode: "PURR10" }).expect(200);
    expect(ok.body.discount).toBe(4000);
    const no = await request(app).post("/v1/cart/quote").set("Origin", STORE).send({ items: [{ variantId: food1kg, qty: 1 }], couponCode: "NOPE10" }).expect(200);
    expect(no.body.couponError).toMatch(/doesn't apply/);
  });
});

describe("pharmacy", () => {
  it("lists pharmacy products by group and keeps prescription medicines out of the cart", async () => {
    const cat = await prisma.category.create({ data: { slug: "tools-dog-medicines", name: "Medicines", pet: "DOG", group: "Pharmacy" } });
    const rx = await prisma.product.create({
      data: { slug: "tools-rx-tablet", name: "Rx Tablet", brand: "Vetco", pet: "DOG", categoryId: cat.id, status: "ACTIVE", tags: ["rx"], minPrice: 50000,
        variants: { create: [{ label: "Strip of 10", price: 50000, mrp: 52000, stock: 20 }] } },
      include: { variants: true },
    });
    await prisma.product.create({
      data: { slug: "tools-otc-dewormer", name: "Dewormer", brand: "Vetco", pet: "DOG", categoryId: cat.id, status: "ACTIVE", minPrice: 30000,
        variants: { create: [{ label: "Strip of 6", price: 30000, mrp: 31000, stock: 20 }] } },
    });
    const list = await request(app).get("/v1/products?group=Pharmacy").expect(200);
    expect(list.body.items.map((p: { slug: string }) => p.slug).sort()).toEqual(["tools-otc-dewormer", "tools-rx-tablet"]);
    expect(list.body.items.find((p: { slug: string }) => p.slug === "tools-rx-tablet").rx).toBe(true);
    const q = await request(app).post("/v1/cart/quote").set("Origin", STORE).send({ items: [{ variantId: rx.variants[0].id, qty: 1 }] }).expect(200);
    expect(q.body.lines).toHaveLength(0);
    expect(q.body.issues[0].message).toMatch(/prescription/);
    await request(app).post("/v1/orders").set("Cookie", customer).set("Origin", STORE).send({ items: [{ variantId: rx.variants[0].id, qty: 1 }], addressId, payment: "COD" }).expect(409);
  });
});

describe("offer badges on product pages", () => {
  it("shows public coupons with a badge only on products they apply to", async () => {
    await a().send("post", "/coupons", { code: "PURRB2G1", type: "BXGY", buyQty: 2, getQty: 1, scope: "BRAND", scopeIds: ["Purrfect"], badgeText: "Buy 2 Get 1" }).expect(201);
    const yes = await request(app).get("/v1/products/tools-tuna-treat").expect(200);
    expect(yes.body.product.offers).toEqual([expect.objectContaining({ code: "PURRB2G1", badge: "Buy 2 Get 1" })]);
    const no = await request(app).get("/v1/products/meowly-salmon-pouch");
    if (no.status === 200) expect(no.body.product.offers.map((o: { code: string }) => o.code)).not.toContain("PURRB2G1");
    await prisma.coupon.update({ where: { code: "PURRB2G1" }, data: { isActive: false } });
  });
});

describe("loyalty, business customers and invoices", () => {
  let orderId = "";

  it("stores business details and tags", async () => {
    await a().send("patch", `/customers/${customerId}`, { companyName: "Happy Paws Grooming", gstin: "27AAPFU0939F1ZV", tags: ["Groomer", "wholesale"], notes: "Prefers morning delivery" }).expect(200);
    await a().send("patch", `/customers/${customerId}`, { gstin: "NOT-A-GSTIN" }).expect(400);
    const list = await a().get("/customers?tag=groomer").expect(200);
    expect(list.body.items[0].companyName).toBe("Happy Paws Grooming");
  });

  it("earns points on delivery and refunds redeemed points on cancel", async () => {
    const placed = await request(app).post("/v1/orders").set("Cookie", customer).set("Origin", STORE).send({ items: [{ variantId: food1kg, qty: 2 }], addressId, payment: "COD" }).expect(201);
    orderId = placed.body.order.id;
    const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(o.billingGstin).toBe("27AAPFU0939F1ZV");
    const orderMove = await a().get(`/inventory/${food1kg}/movements`).expect(200);
    expect(orderMove.body.items[0]).toMatchObject({ delta: -2, reason: "ORDER" });

    for (const status of ["PACKED", "SHIPPED", "DELIVERED"]) await a().send("post", `/orders/${orderId}/status`, { status }).expect(200);
    const c = (await a().get(`/customers/${customerId}`).expect(200)).body;
    // ₹800 delivered × 2 points per ₹100 = 16 points
    expect(c.points).toBe(16);
    expect(c.pointTxns[0]).toMatchObject({ reason: "ORDER", points: 16 });
    expect(c.referralCode).toMatch(/^TK[0-9A-F]{6}$/);

    // Delivering again (or any repeat) must not award twice.
    await a().send("post", `/customers/${customerId}/points`, { points: 100, note: "Goodwill" }).expect(200);
    const q = await request(app).post("/v1/cart/quote").set("Cookie", customer).set("Origin", STORE).send({ items: [{ variantId: food1kg, qty: 1 }], pointsToRedeem: 1000 }).expect(200);
    // 20% of ₹400 = ₹80 max
    expect(q.body.points).toMatchObject({ balance: 116, redeemed: 80, discount: 8000 });
    expect(q.body.total).toBe(32000 + q.body.shippingFee);

    const second = await request(app).post("/v1/orders").set("Cookie", customer).set("Origin", STORE).send({ items: [{ variantId: food1kg, qty: 1 }], addressId, payment: "COD", pointsToRedeem: 80 }).expect(201);
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: customerId } })).points).toBe(36);
    await request(app).post(`/v1/orders/${second.body.order.number}/cancel`).set("Cookie", customer).set("Origin", STORE).send({}).expect(200);
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: customerId } })).points).toBe(116);
  });

  it("builds a GST invoice whose lines add up to the order total", async () => {
    const inv = await a().get(`/orders/${orderId}/invoice`).expect(200);
    expect(inv.body.interState).toBe(true);
    expect(inv.body.buyer.gstin).toBe("27AAPFU0939F1ZV");
    expect(inv.body.lines[0]).toMatchObject({ hsn: "2309", gstRate: 18, qty: 2 });
    expect(inv.body.lines[0].cgst).toBe(0);
    expect(inv.body.totals.total).toBe(inv.body.orderTotal);
    expect(inv.body.totals.taxable + inv.body.totals.igst).toBe(inv.body.orderTotal);
  });
});

describe("import, export and bulk edits", () => {
  const row = (o: Record<string, string>) => ({ pet: "cat", category: "tools-cat-food", brand: "Meowly", name: "Salmon Pouch", price: "45", mrp: "50", stock: "12", ...o });

  it("checks a file without saving and reports row errors", async () => {
    const res = await a()
      .send("post", "/products/import", {
        dryRun: true,
        rows: [row({ option1_name: "Pack", option1_value: "1" }), row({ option1_name: "Pack", option1_value: "6", price: "abc" }), row({ name: "X", brand: "", category: "nope" })],
      })
      .expect(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.errors.map((e: { row: number }) => e.row)).toEqual([3, 4]);
    expect(await prisma.product.count({ where: { brand: "Meowly" } })).toBe(0);
  });

  it("imports grouped variants, then updates them on re-import", async () => {
    const rows = [row({ option1_name: "Pack", option1_value: "1", sku: "MW-SP-1", status: "active" }), row({ option1_name: "Pack", option1_value: "6", sku: "MW-SP-6", price: "249", mrp: "270" })];
    const dry = await a().send("post", "/products/import", { dryRun: true, rows }).expect(200);
    expect(dry.body).toMatchObject({ ok: true, applied: false, summary: { newProducts: 1, variants: 2 } });
    await a().send("post", "/products/import", { dryRun: false, rows }).expect(200);
    const p = await prisma.product.findUniqueOrThrow({ where: { slug: "meowly-salmon-pouch" }, include: { variants: { orderBy: { sortOrder: "asc" } } } });
    expect(p.status).toBe("ACTIVE");
    expect(p.options).toEqual([{ name: "Pack", values: ["1", "6"] }]);
    expect(p.variants.map((v) => [v.label, v.price, v.stock])).toEqual([["1", 4500, 12], ["6", 24900, 12]]);
    expect(p.minPrice).toBe(4500);

    rows[0].stock = "30";
    await a().send("post", "/products/import", { dryRun: false, rows }).expect(200);
    const v = await prisma.variant.findUniqueOrThrow({ where: { sku: "MW-SP-1" } });
    expect(v.stock).toBe(30);
    const moves = await prisma.stockMovement.findMany({ where: { variantId: v.id }, orderBy: { createdAt: "desc" } });
    expect(moves[0]).toMatchObject({ delta: 18, reason: "IMPORT" });
  });

  it("exports the catalogue as CSV in the import format", async () => {
    const res = await a().get("/products/export").expect(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text).toContain("slug,name,brand,pet,category");
    expect(res.text).toContain("meowly-salmon-pouch");
  });

  it("bulk-changes prices, tags and status", async () => {
    const p = await prisma.product.findUniqueOrThrow({ where: { slug: "meowly-salmon-pouch" } });
    await a().send("post", "/products/bulk", { action: "price", ids: [p.id], percent: 10 }).expect(200);
    const v = await prisma.variant.findUniqueOrThrow({ where: { sku: "MW-SP-1" } });
    expect(v.price).toBe(5000); // ₹45 + 10% = ₹49.50 → rounded to ₹50
    expect(v.mrp).toBe(5000);
    await a().send("post", "/products/bulk", { action: "tag", ids: [p.id], mode: "add", tag: "Wet" }).expect(200);
    await a().send("post", "/products/bulk", { action: "status", ids: [p.id], status: "ARCHIVED" }).expect(200);
    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after).toMatchObject({ status: "ARCHIVED", tags: ["wet"], minPrice: 5000 });
  });
});

describe("reports, search, notifications and pages", () => {
  it("reports sales by category and reorder suggestions", async () => {
    const r = await a().get("/reports?days=30").expect(200);
    expect(r.body.summary.orders).toBeGreaterThanOrEqual(1);
    expect(r.body.byCategory.map((c: { name: string }) => c.name)).toContain("Cat Food");
    expect(r.body.daily).toHaveLength(30);
    expect(r.body.stock.value).toBeGreaterThan(0);
  });

  it("searches orders, customers and products in one go", async () => {
    const res = await a().get(`/search?q=${encodeURIComponent("Happy Paws")}`).expect(200);
    expect(res.body.customers[0].companyName).toBe("Happy Paws Grooming");
    const prod = await a().get("/search?q=PF-OF-3").expect(200);
    expect(prod.body.products[0].id).toBe(foodId);
  });

  it("counts unread notifications and marks them seen", async () => {
    await request(app).post("/v1/orders").set("Cookie", customer).set("Origin", STORE).send({ items: [{ variantId: treatVariant, qty: 3 }], addressId, payment: "COD" }).expect(201);
    const n = await a().get("/notifications").expect(200);
    expect(n.body.unread).toBeGreaterThanOrEqual(1);
    expect(n.body.items[0].type).toBe("order");
    await a().send("post", "/notifications/seen", {}).expect(200);
    expect((await a().get("/notifications").expect(200)).body.unread).toBe(0);
  });

  it("publishes editable info pages", async () => {
    await a().send("put", "/pages/shipping-policy", { title: "Shipping policy", body: "## Delivery\n\nMost orders arrive in 2–5 days." }).expect(200);
    const pub = await request(app).get("/v1/pages/shipping-policy").expect(200);
    expect(pub.body.title).toBe("Shipping policy");
    await a().send("put", "/pages/shipping-policy", { title: "Shipping policy", body: "x", isPublished: false }).expect(200);
    await request(app).get("/v1/pages/shipping-policy").expect(404);
  });

  it("blocks customers from admin tools", async () => {
    await request(app).get("/v1/admin/reports").set("Cookie", customer).expect(401);
    await request(app).post("/v1/admin/products/import").set("Cookie", customer).set("Origin", ADMIN).send({ rows: [] }).expect(401);
  });
});
