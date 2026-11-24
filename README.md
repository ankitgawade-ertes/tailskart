# Tailskart — online pet store

A complete e-commerce platform for a pet supplies store — *Their everyday, delivered.* Styled to the Tailskart brand book v1.0 (ultramarine `#2438C8`, fold blue `#65B8F2`, DM Sans, lowercase wordmark with the folded-tape edge): customer storefront, admin panel and API, ready to deploy on AWS.

```
Tailskart/
├── client-frontend/   Customer storefront — Next.js 15 (React 19, Tailwind 4), server-rendered for SEO
├── admin-frontend/    Admin panel — React 19 + Vite SPA (TanStack Query, Tailwind 4)
├── backend/           REST API — Node 22, Express 5, Prisma 6, PostgreSQL 16
├── infra/terraform/   AWS infrastructure as code (ECS Fargate, RDS, S3, CloudFront, ALB, Route 53)
├── .github/workflows/ CI (type-check, tests, builds) and deploy-to-AWS pipelines
├── docker-compose.yml Run everything locally with Docker
└── DEPLOYMENT.md      Step-by-step AWS go-live guide
```

## Architecture

```
                 ┌──────────── Route 53 ────────────┐
                 │                                   │
   tailskart.in / www / api.tailskart.in      admin. / media.tailskart.in
                 │                                   │
        Application Load Balancer (HTTPS)       CloudFront
          │                     │                │        │
   ECS: storefront (Next.js)  ECS: API ──── S3 (admin) S3 (product photos)
                                │   │
                    RDS PostgreSQL   SNS (OTP SMS) · Razorpay (payments)
```

* **Money** is stored as integer **paise** everywhere (₹1 = 100).
* **Prices, stock, coupons and delivery fees are always computed on the server.** The browser cart is only a list of variant IDs and quantities.
* **Stock is reserved atomically** when an order is placed. Unpaid online orders release their stock after 30 minutes.
* **Auth:**
  * Customers log in with a phone OTP (no passwords).
  * Admins log in with email and password and have roles: Super admin, Admin, Staff.
  * Both use separate httpOnly cookies.
  * Requests that change data are checked against an origin allow-list (CSRF protection).
* **Payments:**
  * Razorpay checkout, with server-side signature verification and a webhook for reliability.
  * Cash on delivery within configurable limits.
  * A `mock` mode for development, which is refused when `NODE_ENV=production`.

## Features

**Storefront**
* Home, pet sections, categories, shop by breed, offers, search with live suggestions
* Listings with server-side filters (price, brand, life stage, breed size, diet, flavour, rating, discount), sorting and pagination
* Product pages: photo gallery, sizes with price per 100g, stock levels, pincode delivery estimate, reviews (shown after admin approval), structured data for Google
* Cart with server re-pricing, coupons and free-delivery progress
* Checkout: saved addresses, same-day option, Razorpay or COD
* Accounts: OTP login, orders and tracking timeline, cancellation, addresses, pet profiles, wishlist
* Content pages: blog, FAQ, policies, contact form, newsletter
* SEO: sitemap.xml, robots.txt, canonical URLs, Open Graph tags

**Care routes (brand book: one entrance, clear destinations)**
* `/ametad` — Ametad veterinary hospital: appointment requests (confirmed by phone), "your appointments" list
* `/pharko` — pharko veterinary pharmacy: prescription upload (photo or PDF), status tracking (Received → In review → Ready for pickup → Collected), re-upload when the pharmacist asks for a clearer copy
* Prescription files are stored privately (local `private-uploads/` or a private S3 bucket), never on the public CDN, and only staff can view them through the API; every view is logged

**Admin panel**
* Dashboard: revenue, orders to ship, low stock, top sellers, 14-day chart
* Products: create and edit, sizes/prices/stock, photo upload, specs, highlights, filter attributes
* Categories and breeds
* Orders: filter and search, status workflow (New → Packed → Shipped → Out for delivery → Delivered), cancellations that restore stock, refund tracking, packing slip printing
* Customers: order history, block/unblock
* Coupons: percent or flat, caps, minimum order, dates, usage limits, first order only
* pharko prescriptions queue (view file, ask for info, mark ready/collected) and ametad appointment requests
* Review moderation, contact messages, newsletter CSV export
* Team management with roles, and password change

## Run locally (no Docker needed)

Requires Node.js 22+.

```bash
# 1. API + database
cd backend
npm install
cp .env.example .env
npm run db:local          # starts a local PostgreSQL on port 5433 — leave this terminal open
```

In a second terminal:

```bash
cd backend
npx prisma migrate deploy
npm run db:seed           # categories, breeds, 50 sample products, coupons, first admin
npm run dev               # API on http://localhost:4000
```

```bash
# 2. Storefront (third terminal)
cd client-frontend
npm install
cp .env.example .env.local
npm run dev               # http://localhost:3000
```

```bash
# 3. Admin panel (fourth terminal)
cd admin-frontend
npm install
cp .env.example .env.local
npm run dev               # http://localhost:3001
```

Log in to the admin panel with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `backend/.env`.

In development:
* **Customer OTP codes** are printed in the API terminal (`OTP_PROVIDER=console`).
* **Online payments** run in test mode (`PAYMENT_PROVIDER=mock`).

### With Docker instead

```bash
docker compose up --build
docker compose exec api npm run db:seed
```

## Tests

```bash
cd backend
npm test        # integration tests against the tailskart_test database (needs npm run db:local, or TEST_DATABASE_URL)
```

The tests cover:
* catalog listing and search
* OTP login
* CSRF origin blocking
* server pricing with coupons
* COD and online orders
* oversell protection
* cancellation restoring stock
* order privacy between customers
* admin auth and the fulfilment workflow
* product creation

## Before launch — content to replace

* `client-frontend/src/data/content.ts`: phone, email, WhatsApp, address, social links, policies (privacy and terms are placeholder text — have them reviewed), FAQ answers.
* Testimonials (`TESTIMONIALS`) are empty on purpose. Add real customer quotes only.
* Sample products are illustrative. Replace them with your real catalog, photos and descriptions in the admin panel. To skip them on a fresh database, seed with `SEED_SAMPLE_CATALOG=false`.
* The "Refer a friend" page is a share page only. There is no referral credit system yet.

See **[DEPLOYMENT.md](DEPLOYMENT.md)** to go live on AWS.
