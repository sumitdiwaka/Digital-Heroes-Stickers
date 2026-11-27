# Digital Heroes - API Reference

Base URL: `http://localhost:5000`  (all routes live under `/api`)

## Conventions

| Topic | Rule |
|---|---|
| Auth | `Authorization: Bearer <JWT>` (from register/login). For `<img src>`/download links you may use `?token=<JWT>`. |
| Roles | **Public** (no token) - **Customer** (own data only) - **Admin** (everything). |
| Success | `{ "success": true, "data": ..., "meta": { page, limit, total, pages }? }` |
| Error | `{ "success": false, "error": { "code", "message", "details"? } }` |
| Money | INTEGER **minor units** (paise). `73750` = INR 737.50. Totals include tax (`TAX_NAME`/`TAX_RATE` in `.env`, default GST 18%). |
| Units | All artwork geometry is in **millimetres**, origin = top-left of the TRIM box. Font sizes are in points. |
| IDs | 24-char Mongo ObjectIds. A malformed id returns 422, a missing one 404. |
| Pagination | `?page=1&limit=20` (max 100). |
| Uploads | `multipart/form-data`, field name `file`, max 25 MB. Type is verified from the bytes. |

### Error codes
`VALIDATION_ERROR` 422 | `BAD_REQUEST` 400 | `UNAUTHORIZED` 401 | `FORBIDDEN` 403 | `NOT_FOUND` 404 | `CONFLICT` 409 | `FILES_LOCKED` 423 (approval gate) | `OUTSIDE_PRINT_AREA` 422 | `CSV_COLUMNS_MISSING` 422 | `RATE_LIMITED` 429

### Order pipeline
`quote -> order -> artwork -> proof -> production -> completed` (+ `cancelled`)
- **quote**: priced, unpaid. **order -> artwork -> proof**: automatic after payment (proof v1 is generated).
- **Approval gate**: print files stay locked (HTTP 423) and production cannot start until the customer approves the latest proof.
- **production -> completed**: advanced by an admin. Completed jobs can be archived and reordered in one click.

### Element object (designer)
```json
{ "id": "number-3", "type": "text", "x": 9.5, "y": 35, "width": 171, "height": 70, "rotation": 0,
  "text": "1234", "variableKey": "number", "fontFamily": "Condensed", "fontWeight": "bold", "fontStyle": "normal",
  "fontSize": 400, "minFontSize": 30, "maxFontSize": 400, "tracking": 0, "minTracking": -1, "shrinkToFit": true,
  "align": "center", "color": "#111111" }
```
`type`: `text` | `image` (needs `assetId`) | `rect` (`fill`, `stroke`, `strokeWidth`). `variableKey` marks a CSV merge field.
Fonts: `Sans`, `Condensed`, `Serif`, `Mono`. Text/images must sit inside the **safe area**; `rect` may extend into the **bleed**.

---

## 00 Health

### Health check
`GET /api/health`  -  **Public**  -  expect `200`

Is the server up?

*Returns:* { success, data: { status:"ok", time, env } }

## 01 Public catalogue

### List divisions (product hub tiles)
`GET /api/divisions`  -  **Public**  -  expect `200`

The six print divisions with productCount.

*Returns:* data: [{ _id, slug, name, tagline, description, productCount }]

### List products
`GET /api/products`  -  **Public**  -  expect `200`

All active products. Saves ids used by later requests.

*Returns:* data: [Product]

### List products by division
`GET /api/products?division=race-event-numbers`  -  **Public**  -  expect `200`

Filter by division slug or id. Optional ?q= text search.

*Returns:* data: [Product]

### Product detail (configurator data)
`GET /api/products/race-bibs`  -  **Public**  -  expect `200`

Full options: sizing presets, materials, orientations, quantity limits, volume tiers, print spec, templates, tax.

*Returns:* data: { product, templates:[{_id,name,group}], tax:{name,rate}, currency }

### Volume discount tiers
`GET /api/pricing/tiers/custom-stickers`  -  **Public**  -  expect `200`

Tier table for display.

*Returns:* data: { tiers:[{minQty,discountPct}] }

### Work gallery (grouped by division)
`GET /api/gallery`  -  **Public**  -  expect `200`

Optional ?division=<slug>.

*Returns:* data: [{ division, items:[{title,caption,imageUrl}] }]

### Designer fonts
`GET /api/designer/fonts`  -  **Public**  -  expect `200`

Font families the designer + print engine support.

*Returns:* data: { families:["Sans","Condensed","Serif","Mono"], weights, styles }

## 02 Instant pricing

### Quote - stickers qty 50 (no discount)
`POST /api/pricing/quote`  -  **Public**  -  expect `200`

PUBLIC, stateless. Expected: unit 500, subtotal 40000, tax 7200, total 47200 (minor units).

*Body (JSON):*
```json
{
  "product": "custom-stickers",
  "config": {
    "sizeKey": "50x50",
    "material": "paper-gloss"
  },
  "quantity": 50
}
```

*Returns:* data: { config, pricing:{ unitPriceMinor, discountPct, subtotalMinor, taxMinor, totalMinor, ... }, nextTier }

### Quote - stickers qty 100 (5% volume discount)
`POST /api/pricing/quote`  -  **Public**  -  expect `200`

Discount floor is 100 units. Expected: discountPct 5, unit 475, total 73750.

*Body (JSON):*
```json
{
  "product": "custom-stickers",
  "config": {
    "sizeKey": "50x50",
    "material": "paper-gloss"
  },
  "quantity": 100
}
```

*Returns:* same as above

### Quote - custom size + portrait
`POST /api/pricing/quote`  -  **Public**  -  expect `200`

Dynamic sizing - no SKU per size. Portrait makes the long side vertical (100 x 200).

*Body (JSON):*
```json
{
  "product": "custom-stickers",
  "config": {
    "widthMm": 200,
    "heightMm": 100,
    "material": "vinyl-white",
    "orientation": "portrait"
  },
  "quantity": 250
}
```

*Returns:* same as above

### Quote - ERROR: below minimum quantity
`POST /api/pricing/quote`  -  **Public**  -  expect `400`

Expected 400 "Minimum quantity is 25".

*Body (JSON):*
```json
{
  "product": "custom-stickers",
  "config": {
    "sizeKey": "50x50",
    "material": "paper-gloss"
  },
  "quantity": 5
}
```

*Returns:* error: { code:"BAD_REQUEST", message }

### Quote - ERROR: unknown material
`POST /api/pricing/quote`  -  **Public**  -  expect `400`

Expected 400 with details.allowed list.

*Body (JSON):*
```json
{
  "product": "custom-stickers",
  "config": {
    "sizeKey": "50x50",
    "material": "gold-leaf"
  },
  "quantity": 100
}
```

*Returns:* error.details.allowed = [...]

## 03 Auth

### Register customer
`POST /api/auth/register`  -  **Public**  -  expect `201`

Always creates role=customer. Password: min 8 chars, letter + number. Returns a JWT.

*Body (JSON):*
```json
{
  "name": "Test Customer",
  "email": "customer_{{$timestamp}}@test.com",
  "password": "Passw0rd!x",
  "phone": "9999999999",
  "company": "Acme Runs"
}
```

*Returns:* data: { user, token }

### Register - ERROR: weak password
`POST /api/auth/register`  -  **Public**  -  expect `422`

Expected 422 VALIDATION_ERROR with field paths.

*Body (JSON):*
```json
{
  "name": "Weak",
  "email": "weak@test.com",
  "password": "abc"
}
```

*Returns:* error.details = [{ path, message }]

### Login customer
`POST /api/auth/login`  -  **Public**  -  expect `200`

Returns JWT. Send it as  Authorization: Bearer <token>.

*Body (JSON):*
```json
{
  "email": "{{customerEmail}}",
  "password": "{{customerPassword}}"
}
```

*Returns:* data: { user, token }

### Login admin
`POST /api/auth/login`  -  **Public**  -  expect `200`

Seeded admin account (npm run seed).

*Body (JSON):*
```json
{
  "email": "admin@digitalheroes.test",
  "password": "Admin@12345"
}
```

*Returns:* data: { user:{role:"admin"}, token }

### Login - ERROR: wrong password
`POST /api/auth/login`  -  **Public**  -  expect `401`

Expected 401 (same message for unknown email).

*Body (JSON):*
```json
{
  "email": "{{customerEmail}}",
  "password": "WrongPass1"
}
```

*Returns:* error.code = UNAUTHORIZED

### Me (profile)
`GET /api/auth/me`  -  **Customer**  -  expect `200`

Current user.

*Returns:* data: { user }

### Update profile
`PATCH /api/auth/me`  -  **Customer**  -  expect `200`

Strict schema: role / email cannot be changed here.

*Body (JSON):*
```json
{
  "phone": "9876543210",
  "company": "Acme Runs Ltd",
  "gstin": "07ABCDE1234F1Z5",
  "address": {
    "line1": "1 Main Street",
    "city": "Delhi",
    "state": "Delhi",
    "postalCode": "110001",
    "country": "IN"
  }
}
```

*Returns:* data: { user }

### Forgot password
`POST /api/auth/forgot-password`  -  **Public**  -  expect `200`

Always 200 (no account enumeration). In non-production the response includes devToken for testing.

*Body (JSON):*
```json
{
  "email": "{{customerEmail}}"
}
```

*Returns:* data: { message, devToken? }

### Reset password
`POST /api/auth/reset-password`  -  **Public**  -  expect `200`

Single-use token, valid 1 hour.

*Body (JSON):*
```json
{
  "token": "{{resetToken}}",
  "newPassword": "ResetPass99"
}
```

*Returns:* data: { message }

### Login customer (new password)
`POST /api/auth/login`  -  **Public**  -  expect `200`

Confirms the reset worked.

*Body (JSON):*
```json
{
  "email": "{{customerEmail}}",
  "password": "{{customerPassword}}"
}
```

*Returns:* data: { user, token }

### Change password
`POST /api/auth/change-password`  -  **Customer**  -  expect `200`

Requires the current password.

*Body (JSON):*
```json
{
  "currentPassword": "{{customerPassword}}",
  "newPassword": "ChangedPass77"
}
```

*Returns:* data: { message }

### ROLE CHECK: customer calls admin API
`GET /api/admin/orders`  -  **Customer**  -  expect `403`

Expected 403 FORBIDDEN.

*Returns:* error.code = FORBIDDEN

## 04 Designer

### Instantiate template at real size
`GET /api/templates/{{templateId}}/instantiate?sizeKey=bib-190x140&material=tyvek`  -  **Public**  -  expect `200`

Template placeholders (stored as fractions) become editable mm-based elements for the chosen size, plus the three print areas (trim / safe / bleed). Text is clamped inside the safe area.

*Returns:* data: { background, trim, areas:{trim,safe,bleed}, elements:[...] }

### Validate - valid layout
`POST /api/designs/validate`  -  **Customer**  -  expect `200`

Live print-area check (no save). Use on every drag/resize in the editor.

*Body (JSON):*
```json
{ "product": "{{bibProductId}}", "config": {"sizeKey":"bib-190x140","material":"tyvek"}, "elements": {{bibElements}} }
```

*Returns:* data: { valid:true, errors:[], warnings:[], areas }

### Validate - element OUTSIDE print area
`POST /api/designs/validate`  -  **Customer**  -  expect `200`

Rotated bounding boxes are checked too. Text/images must be inside the SAFE area (5mm inset); colour rects may reach into the 3mm bleed.

*Body (JSON):*
```json
{
  "product": "{{bibProductId}}",
  "config": {
    "sizeKey": "bib-190x140",
    "material": "tyvek"
  },
  "elements": [
    {
      "id": "oops",
      "type": "text",
      "text": "TOO FAR RIGHT",
      "x": 180,
      "y": 10,
      "width": 50,
      "height": 20,
      "fontFamily": "Sans",
      "fontSize": 20
    }
  ]
}
```

*Returns:* data: { valid:false, errors:[{ elementId, code:"OUTSIDE_PRINT_AREA", bounds, allowed }] }

### Upload logo asset (PNG/JPG/SVG)
`POST /api/uploads/asset`  -  **Customer**  -  expect `201`

multipart/form-data, field "file". Type is verified from file BYTES, not the extension. Use returned id as element.assetId.

*Body:* `multipart/form-data`  `file` = file (samples/logo.png)

*Returns:* data: { id, originalName, ext, widthPx, heightPx, url }

### Save design (template layout)
`POST /api/designs`  -  **Customer**  -  expect `201`

Saved designs live on the account. Unprintable layouts are refused with 422 OUTSIDE_PRINT_AREA.

*Body (JSON):*
```json
{ "name": "City 10K bib", "product": "{{bibProductId}}", "template": "{{templateId}}", "config": {"sizeKey":"bib-190x140","material":"tyvek"}, "background": "{{bibBackground}}", "elements": {{bibElements}} }
```

*Returns:* data: { design, warnings }

### List my designs
`GET /api/designs`  -  **Customer**  -  expect `200`

Optional ?approved=true&product=<id>.

*Returns:* data: [Design]

### Live preview PNG (with variable test values)
`GET /api/designs/{{designId}}/preview.png?var_name=Test%20Runner&var_number=77`  -  **Customer**  -  expect `200`

Real-time proof preview. ?var_<key>=value lets the editor try variable text.

*Returns:* image/png (trim line + PREVIEW watermark)

### Rename design
`PATCH /api/designs/{{designId}}`  -  **Customer**  -  expect `200`

Also accepts config, background, elements.

*Body (JSON):*
```json
{
  "name": "City 10K bib v2"
}
```

*Returns:* data: { design, warnings }

## 05 Order, CSV, proof, approval

### Create QUOTE from design
`POST /api/orders`  -  **Customer**  -  expect `201`

Creates status=quote. Price is ALWAYS recalculated on the server. "product" accepts slug or id.

*Body (JSON):*
```json
{
  "product": "race-bibs",
  "config": {
    "sizeKey": "bib-190x140",
    "material": "tyvek"
  },
  "quantity": 50,
  "design": "{{designId}}",
  "notes": "Event on 12 Dec"
}
```

*Returns:* data: { order }  (order.pricing has the frozen price)

### CSV template (header row)
`GET /api/orders/{{orderId}}/csv-template`  -  **Customer**  -  expect `200`

Header row the customer should fill in (one column per variable field).

*Returns:* text/csv

### Upload CSV (variable data)
`POST /api/orders/{{orderId}}/csv`  -  **Customer**  -  expect `200`

Quote only. One artwork per row; quantity becomes the row count and the price is recalculated. Fields missing from the CSV fall back to the element's default text.

*Body:* `multipart/form-data`  `file` = file (samples/race_numbers.csv)

*Returns:* data: { rowCount, columns, unusedColumns, fieldsUsingDefaultText, sampleRows, pricing }

### Start checkout (mock / Stripe)
`POST /api/payments/checkout`  -  **Customer**  -  expect `200`

Stripe -> returns clientSecret for Stripe.js. No STRIPE_SECRET_KEY -> MOCK provider.

*Body (JSON):*
```json
{
  "orderId": "{{orderId}}"
}
```

*Returns:* data: { provider, intentId|clientSecret, amountMinor, currency }

### MOCK: confirm payment
`POST /api/payments/mock/confirm`  -  **Customer**  -  expect `200`

Simulates a successful payment (disabled when Stripe is configured). Order -> artwork -> proof v1 generated automatically. Emails fire.

*Body (JSON):*
```json
{
  "orderId": "{{orderId}}"
}
```

*Returns:* data: { order:{ status:"proof", payment:{ status:"paid", invoiceNumber } } }

### List proofs
`GET /api/orders/{{orderId}}/proofs`  -  **Customer**  -  expect `200`

Every revision (v1, v2, ...) with status pending/approved/changes_requested/superseded.

*Returns:* data: { latestVersion, approvedVersion, proofs:[{ version, status, origin, createdAt }] }

### Proof preview image (v1)
`GET /api/orders/{{orderId}}/proofs/1/preview.png`  -  **Customer**  -  expect `200`

PNG. For <img src> use ?token=<jwt> instead of the header.

*Returns:* image/png

### GATE: admin file list is LOCKED before approval
`GET /api/admin/orders/{{orderId}}/files`  -  **Admin**  -  expect `423`

Expected 423 FILES_LOCKED. Print files unlock only after a proof is approved.

*Returns:* error.code = FILES_LOCKED

### GATE: admin cannot move to production yet
`POST /api/admin/orders/{{orderId}}/advance`  -  **Admin**  -  expect `409`

Expected 409 "Approval gate: the customer has not approved a proof yet".

*Body (JSON):*
```json
{
  "toStatus": "production"
}
```

*Returns:* error.code = CONFLICT

### Request changes on v1
`POST /api/orders/{{orderId}}/proofs/1/request-changes`  -  **Customer**  -  expect `200`

Admins get an email. Only the latest proof can be reviewed.

*Body (JSON):*
```json
{
  "note": "Please make the logo bigger"
}
```

*Returns:* data: { proof:{ status:"changes_requested" }, next }

### Update artwork -> proof v2 generated
`PUT /api/orders/{{orderId}}/artwork`  -  **Customer**  -  expect `200`

Body is {design:"<id>"} OR {elements, background}. Frozen snapshot is replaced and the next proof version is created. Locked after approval.

*Body (JSON):*
```json
{ "elements": {{bibElements}}, "background": "{{bibBackground}}" }
```

*Returns:* data: { order, newProofVersion: 2 }

### ERROR: approve OLD version v1
`POST /api/orders/{{orderId}}/proofs/1/approve`  -  **Customer**  -  expect `409`

Expected 409 - only the latest proof can be approved.

*Returns:* error.code = CONFLICT

### APPROVE proof v2
`POST /api/orders/{{orderId}}/proofs/2/approve`  -  **Customer**  -  expect `200`

Approval is logged (who/which version/when). Opens the gate: filesUnlocked=true and print-file generation starts in the background.

*Returns:* data: { proof, order:{ filesUnlocked:true, approvedProofVersion:2 }, message }

### Approval log
`GET /api/orders/{{orderId}}/approval-log`  -  **Customer**  -  expect `200`

Append-only audit trail.

*Returns:* data: [{ version, action, byName, byRole, note, at }]

### Order detail (customer view)
`GET /api/orders/{{orderId}}`  -  **Customer**  -  expect `200`

Customers never receive printFiles / printJob.

*Returns:* data: { order, proofs }

### Order history
`GET /api/orders?page=1&limit=10`  -  **Customer**  -  expect `200`

Optional ?status=. Paginated.

*Returns:* data: [Order], meta: { page, limit, total, pages }

### Invoice PDF
`GET /api/orders/{{orderId}}/invoice`  -  **Customer**  -  expect `200`

Paid orders only.

*Returns:* application/pdf

### Cancel an unpaid quote (example)
`DELETE /api/orders/{{orderId}}`  -  **Customer**  -  expect `409`

Only quotes can be cancelled by the customer - this one is already paid, so 409 is expected.

*Returns:* error.code = CONFLICT

## 06 Admin production pipeline

### Admin dashboard (queue overview)
`GET /api/admin/dashboard`  -  **Admin**  -  expect `200`

Counts per stage, ready-for-production, awaiting approval, running print jobs.

*Returns:* data: { pipeline, readyForProduction, awaitingCustomerApproval, printJobsRunning }

### Search jobs
`GET /api/admin/orders?status=proof&paid=true&page=1`  -  **Admin**  -  expect `200`

Filters: status (comma list), customer (id / name / email / company), q (order number), product (productType), division (slug), from, to, ready=true, paid=true, archived=true.

*Returns:* data: [{ id, orderNumber, status, customer, filesUnlocked, readyForProduction, printJob, ... }], meta

### Job ticket (full order)
`GET /api/admin/orders/{{orderId}}`  -  **Admin**  -  expect `200`

Order + customer + proofs + approval log + files (files only when unlocked).

*Returns:* data: { order, summary, proofs, approvalLog, files, filesLockedReason }

### Print files list (unlocked)
`GET /api/admin/orders/{{orderId}}/files`  -  **Admin**  -  expect `200`

Wait a few seconds after approval until printJob.status = "done". Naming: OrderID_ProductType_Date_Output.ext inside orders/<OrderID>/.

*Returns:* data: { directory, printJob:{status,progress,total,warnings}, files:[{name,type,size,row,downloadUrl}], zipUrl }

### Download ALL files (.zip)
`GET /api/admin/orders/{{orderId}}/files.zip`  -  **Admin**  -  expect `200`

Single-file download: GET .../files/<name> (use the downloadUrl from the list).

*Returns:* application/zip

### Regenerate print files
`POST /api/admin/orders/{{orderId}}/regenerate-files?png=true`  -  **Admin**  -  expect `202`

Re-runs the background job. ?png=false skips PNGs (faster for huge CSV jobs).

*Returns:* data: { message, statusUrl }

### Advance: proof -> production
`POST /api/admin/orders/{{orderId}}/advance`  -  **Admin**  -  expect `200`

Body optional: {toStatus?, note?}. Default = next stage. Pipeline: quote > order > artwork > proof > production > completed. Stages cannot be skipped; customer is emailed.

*Body (JSON):*
```json
{
  "note": "Printing now"
}
```

*Returns:* data: { id, status, ... }

### Advance: production -> completed
`POST /api/admin/orders/{{orderId}}/advance`  -  **Admin**  -  expect `200`

Completion email is sent.

*Body (JSON):*
```json
{}
```

*Returns:* data: { status:"completed" }

### Archive completed job
`POST /api/admin/orders/{{orderId}}/archive`  -  **Admin**  -  expect `200`

Completed/cancelled only. Browse with ?archived=true. /unarchive reverses it.

*Returns:* data: { archived:true }

### Reports & analytics
`GET /api/admin/reports/summary`  -  **Admin**  -  expect `200`

Optional ?from=&to= (ISO dates).

*Returns:* data: { totals, byStatus, productFamilyThroughput, daily, topCustomers }

### Xero-ready invoice export (CSV)
`GET /api/admin/export/xero-invoices.csv`  -  **Admin**  -  expect `200`

Columns match Xero's sales-invoice import template.

*Returns:* text/csv

### Email outbox (dev aid)
`GET /api/admin/notifications/outbox`  -  **Admin**  -  expect `200`

Last 50 emails the system sent.

*Returns:* data: [{ to, subject, at }]

## 07 Reorder

### One-click reorder (quote + payment intent)
`POST /api/orders/{{orderId}}/reorder`  -  **Customer**  -  expect `201`

Clones config, artwork and CSV into a new quote at TODAY'S prices and starts checkout in the same call. Optional {quantity} (ignored for CSV orders). {checkout:false} returns the quote only.

*Body (JSON):*
```json
{
  "checkout": true
}
```

*Returns:* data: { order, priceChanged, previousTotalMinor, artworkCarriedOver, payment }

### Pay the reorder -> approval carried over
`POST /api/payments/mock/confirm`  -  **Customer**  -  expect `200`

Identical artwork was already approved, so the new order lands with filesUnlocked=true (logged as "carried_over") - no redesign, no re-approval.

*Body (JSON):*
```json
{
  "orderId": "{{reorderId}}"
}
```

*Returns:* data: { order:{ filesUnlocked:true } }

## 08 Upload path (finished artwork)

### Create empty design for stickers
`POST /api/designs`  -  **Customer**  -  expect `201`

Shell design to attach a finished file to.

*Body (JSON):*
```json
{
  "name": "Uploaded sticker",
  "product": "{{stickerProductId}}",
  "config": {
    "widthMm": 100,
    "heightMm": 50,
    "material": "vinyl-white"
  },
  "elements": []
}
```

*Returns:* data: { design }

### Upload SVG artwork
`POST /api/designs/{{uploadDesignId}}/artwork`  -  **Customer**  -  expect `201`

Accepts PDF, SVG, AI, PNG (JPG too). PNG/SVG are fitted into the trim area; PDF/AI are passed through to production (placeholder proof preview).

*Body:* `multipart/form-data`  `file` = file (samples/artwork.svg)

*Returns:* data: { design:{ source:"upload", upload:{ext,...} }, note? }

### Order from uploaded artwork (qty 100)
`POST /api/orders`  -  **Customer**  -  expect `201`

Gets the 5% volume discount.

*Body (JSON):*
```json
{
  "product": "custom-stickers",
  "config": {
    "widthMm": 100,
    "heightMm": 50,
    "material": "vinyl-white"
  },
  "quantity": 100,
  "design": "{{uploadDesignId}}"
}
```

*Returns:* data: { order }

### Checkout
`POST /api/payments/checkout`  -  **Customer**  -  expect `200`

-

*Body (JSON):*
```json
{
  "orderId": "{{uploadOrderId}}"
}
```

*Returns:* data: { provider, intentId }

### MOCK: confirm payment
`POST /api/payments/mock/confirm`  -  **Customer**  -  expect `200`

-

*Body (JSON):*
```json
{
  "orderId": "{{uploadOrderId}}"
}
```

*Returns:* data: { order }

### Approve proof v1
`POST /api/orders/{{uploadOrderId}}/proofs/1/approve`  -  **Customer**  -  expect `200`

-

*Returns:* data: { proof, order }

## 09 Customer dashboard

### Dashboard - all 6 modules in one call
`GET /api/dashboard/customer`  -  **Customer**  -  expect `200`

profile (status/completeness) | orders (counts + recent) | savedDesigns (with configuration) | activeProofs (version state) | reorderable (one-click reorder) | invoices.

*Returns:* data: { profile, orders, savedDesigns, activeProofs, reorderable, invoices }

### Invoices list
`GET /api/invoices`  -  **Customer**  -  expect `200`

Each has a downloadUrl.

*Returns:* data: [{ orderNumber, invoiceNumber, totalMinor, downloadUrl }]

## 10 Admin: users

### List users
`GET /api/admin/users?q=test&page=1`  -  **Admin**  -  expect `200`

Filters: q (name/email/company), role.

*Returns:* data: [User], meta

### User detail + spend stats
`GET /api/admin/users/{{userId}}`  -  **Admin**  -  expect `200`

-

*Returns:* data: { user, stats:{ orders, spentMinor } }

### Disable / enable / change role
`PATCH /api/admin/users/{{userId}}`  -  **Admin**  -  expect `200`

Disabled users' tokens stop working immediately. Admins cannot demote/disable themselves.

*Body (JSON):*
```json
{
  "isActive": true
}
```

*Returns:* data: User

### Create user (admin or customer)
`POST /api/admin/users`  -  **Admin**  -  expect `201`

-

*Body (JSON):*
```json
{
  "name": "Second Admin",
  "email": "admin2_{{$timestamp}}@digitalheroes.test",
  "password": "Admin@12345",
  "role": "admin"
}
```

*Returns:* data: User

## 11 Admin: catalogue management

### Create a NEW division
`POST /api/admin/divisions`  -  **Admin**  -  expect `201`

New divisions need no code change.

*Body (JSON):*
```json
{
  "slug": "magnets-{{$timestamp}}",
  "name": "Fridge Magnets",
  "tagline": "Stick around",
  "sortOrder": 7
}
```

*Returns:* data: Division

### Create a parameter-driven product
`POST /api/admin/products`  -  **Admin**  -  expect `201`

Prices in MINOR units (paise). One product models every size/material - never one SKU per size.

*Body (JSON):*
```json
{
  "division": "{{divisionId}}",
  "slug": "magnet-{{$timestamp}}",
  "name": "Custom Magnet",
  "productType": "magnets",
  "description": "Flexible magnet.",
  "sizing": {
    "mode": "both",
    "presets": [
      {
        "key": "m50",
        "label": "50 x 50 mm",
        "widthMm": 50,
        "heightMm": 50
      }
    ],
    "minMm": 20,
    "maxWidthMm": 200,
    "maxHeightMm": 200
  },
  "materials": [
    {
      "key": "flex",
      "label": "Flexible magnet",
      "multiplier": 1,
      "surchargeMinor": 0
    }
  ],
  "orientations": [
    "landscape",
    "portrait"
  ],
  "quantity": {
    "min": 1,
    "max": 1000
  },
  "supportsVariableData": false,
  "pricing": {
    "basePerUnitMinor": 1000,
    "pricePerCm2Minor": 10,
    "minUnitPriceMinor": 1000,
    "setupFeeMinor": 0,
    "volumeTiers": [
      {
        "minQty": 10,
        "discountPct": 10
      },
      {
        "minQty": 100,
        "discountPct": 20
      }
    ]
  },
  "printSpec": {
    "bleedMm": 2,
    "safeMarginMm": 2,
    "dpi": 300
  }
}
```

*Returns:* data: Product

### Update product pricing live
`PUT /api/admin/products/{{newProductId}}`  -  **Admin**  -  expect `200`

Partial update.

*Body (JSON):*
```json
{
  "pricing": {
    "basePerUnitMinor": 2000,
    "pricePerCm2Minor": 10,
    "volumeTiers": [
      {
        "minQty": 10,
        "discountPct": 15
      }
    ]
  }
}
```

*Returns:* data: Product

### Create template
`POST /api/admin/templates`  -  **Admin**  -  expect `201`

Placeholder geometry is a FRACTION (0..1) of the trim size so one template fits any size. Per-placeholder fitting rules: shrinkToFit, minFontSize, maxFontSize, tracking, minTracking.

*Body (JSON):*
```json
{
  "product": "{{newProductId}}",
  "name": "Simple magnet",
  "group": "general",
  "background": "#FFFFFF",
  "placeholders": [
    {
      "key": "headline",
      "type": "text",
      "defaultText": "HELLO",
      "x": 0.1,
      "y": 0.2,
      "w": 0.8,
      "h": 0.5,
      "fontFamily": "Sans",
      "fontWeight": "bold",
      "color": "#111111",
      "minFontSize": 6,
      "maxFontSize": 80
    }
  ]
}
```

*Returns:* data: Template

### Add gallery item
`POST /api/admin/gallery`  -  **Admin**  -  expect `201`

-

*Body (JSON):*
```json
{
  "division": "{{divisionId}}",
  "title": "Fridge magnets",
  "caption": "Flexible magnet run",
  "imageUrl": "https://placehold.co/800x600?text=Magnets",
  "tags": [
    "magnets"
  ]
}
```

*Returns:* data: GalleryItem

### Deactivate product (soft delete)
`DELETE /api/admin/products/{{newProductId}}`  -  **Admin**  -  expect `200`

Soft delete - order history keeps its snapshots.

*Returns:* data: { deactivated:true }

### Deactivate division
`DELETE /api/admin/divisions/{{divisionId}}`  -  **Admin**  -  expect `200`

-

*Returns:* data: { deactivated:true }
