# Digital Heroes - Backend (Node.js / Express / MongoDB)

Web-to-print platform backend for the Digital Heroes PRD (Level 2). Six print divisions, parameter-driven products,
instant pricing, in-browser designer support, server-side print-file engine with CSV merge, proof versioning with an
approval gate, customer dashboard, and an admin production pipeline.

**Stack:** Node 18+ | Express 4 | MongoDB (Mongoose 8) | JWT | Zod | PDFKit + Sharp + Fontkit | Stripe (optional) | Nodemailer

## 1. Quick start

```bash
npm install
cp .env.example .env        # edit MONGODB_URI + JWT_SECRET
npm run seed                # admin + customer accounts, 6 divisions, 6 products, templates, gallery
npm run dev                 # http://localhost:5000      (npm start in production)
```

MongoDB: a local `mongod`, Docker (`docker run -p 27017:27017 mongo:7`) or a free MongoDB Atlas cluster.

Seeded logins (change in `.env`):

| Role | Email | Password |
|---|---|---|
| Admin | admin@digitalheroes.test | Admin@12345 |
| Customer | customer@digitalheroes.test | Customer@12345 |

`npm run seed:reset` wipes the database first.

Check it works: `GET http://localhost:5000/api/health`

## 2. Testing

The test suite is shipped **separately** (`digital-heroes-api-tests.zip`): an automated 195-check end-to-end runner
and a Postman collection. Start this backend, then run the tests from the other folder.
Tip: run the backend with `DISABLE_RATE_LIMIT=true` while testing repeatedly.

## 3. Features -> where they live

| PRD section | Implementation |
|---|---|
| 04 Catalogue, parameter-driven | `models/Product.js` (one product = every size/material/orientation/qty), `routes/catalogue.js` |
| 05 Pricing & checkout | `services/pricing.js` (pure functions), `services/paymentService.js` (Stripe or MOCK), tax in `.env` |
| 06 Designer | `services/designService.js` (print-area enforcement, template instantiation), `routes/designs.js` |
| 07 Print-file engine | `services/printService.js`, `services/print/*` (fonts, fitting rules, PDF/PNG renderer) |
| 08 Proof & versions | `services/orderService.js` (`createProof`, `approveProof`, `requestChanges`), `models/Proof.js`, `ApprovalLog.js` |
| 09-10 Accounts, reorder, dashboard | `routes/auth.js`, `routes/orders.js` (reorder), `routes/dashboard.js` |
| 11 Production dashboard | `routes/admin.js`, `services/reportService.js` |
| 13 Technical | helmet, CORS, rate limits, NoSQL-injection sanitising, Zod validation, bcrypt, JWT, server-side file generation, email notifications |
| 14 Scalability | DB-driven divisions/products/templates, storage abstraction, `organizationId` hook, Xero-ready export |

Full endpoint list with JSON bodies: **`docs/API.md`**. Data model: **`docs/SCHEMA.md`**. Decisions: **`docs/DECISIONS.md`**.

## 4. Folder structure

```
src/
  app.js, server.js
  config/        env.js, db.js
  models/        User, Division, Product, Template, Design, Asset, Order, Proof, ApprovalLog, Gallery, Counter
  middleware/    auth (JWT + roles), validate (Zod), upload (multer + byte sniffing), error
  routes/        auth, catalogue (public), designs, orders, payments, dashboard, admin
  services/      pricing, designService, printService, orderService, paymentService,
                 invoiceService, reportService, xeroService, email, storage
    print/       fonts, fit (shrink-to-fit/tracking), render (PDF + PNG)
  validators.js  all request schemas
scripts/seed.js
assets/fonts/    bundled DejaVu fonts (free licence) -> identical output on every server
storage/         uploaded files + generated proofs/print files (local-disk driver)
```

## 5. Environment variables

See `.env.example`. Important ones: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URLS` (React origins for CORS),
`TAX_NAME`/`TAX_RATE`/`CURRENCY`, `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`, `SMTP_*`, `STORAGE_DIR`.
Never commit `.env` (it is in `.gitignore`).

- **No `STRIPE_SECRET_KEY`** -> MOCK payments: `POST /api/payments/checkout` then `POST /api/payments/mock/confirm`.
- **No `SMTP_HOST`** -> emails are logged to the console (and visible at `GET /api/admin/notifications/outbox`).

## 6. Going live (important)

- **Hosting:** run this on a long-running Node host (Render, Railway, Fly.io, a VPS). It is NOT suited to Vercel
  serverless: it writes files to disk and runs background print jobs. Host the React frontend on Vercel and point it here.
- **Database:** MongoDB Atlas (new project/cluster, per the PRD's "new account" rule).
- **Storage:** the local-disk driver needs a persistent volume. For scale, re-implement the 6 functions in
  `services/storage.js` for S3 / Cloudflare R2 / Supabase Storage - nothing else changes.
- **Print jobs** run in-process (`setImmediate`) and survive restarts safely (stuck jobs are marked failed and can be
  re-run). For heavy traffic move `printService.generateAll` behind a queue (BullMQ + Redis).
- **Stripe:** set the keys and point a webhook for `payment_intent.succeeded` / `payment_intent.payment_failed` to
  `POST /api/payments/webhook`.
- Set `NODE_ENV=production`, a long random `JWT_SECRET`, and `CLIENT_URLS` to your real frontend URL.

## 7. Frontend integration cheatsheet (React)

- Store the JWT after login; send `Authorization: Bearer <token>`. Use `?token=` only for `<img>`/download links.
- Price calculator: `POST /api/pricing/quote` on every option change (debounce ~200 ms).
- Designer: load `GET /api/templates/:id/instantiate`, call `POST /api/designs/validate` while dragging, show
  `GET /api/designs/:id/preview.png`.
- After payment, poll `GET /api/orders/:id` until `status === "proof"`, then show the proof image.
- Admin: after approval poll `GET /api/admin/orders/:id/files` until `printJob.status === "done"`.
