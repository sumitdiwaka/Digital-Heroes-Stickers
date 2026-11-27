# Design decisions (where the PRD is silent)

The PRD asks to "make a reasonable decision, document it, and be ready to defend it". These are ours.

| # | Ambiguity | Decision | Why |
|---|---|---|---|
| 1 | **Stack** - PRD recommends Next.js + Supabase | Express + MongoDB + React (the team's stack) | PRD allows equivalents "if justified". Same architecture: server APIs, structured DB, cloud-ready storage. |
| 2 | **"Quote" stage vs "no quote forms"** | Pricing is instant and public. A **quote** is the saved, priced, unpaid order (`status=quote`); paying turns it into an order. | Keeps the PRD pipeline literal without any waiting or forms. |
| 3 | **Who creates proofs?** | The system auto-generates proof v1 after payment from the designer/upload. Admins can add manual proofs (`POST /api/admin/orders/:id/proofs`). Editing artwork before approval creates the next version automatically. | Fast for the customer, flexible for staff. |
| 4 | **Where are print files?** | Generated only after approval, in the background. Locked (HTTP 423) until then; production cannot start. | The "approval gate" requirement. |
| 5 | **Customers "access its files" vs "never see production files"** | Customers see order history, proofs (preview PNGs) and invoices - never print-ready PDFs/CSV artwork. | Satisfies both sentences literally. |
| 6 | **Print area definition** | Trim box = product size. Text/images must be inside the **safe area** (trim inset by `safeMarginMm`); colour rects may extend into the **bleed** (`bleedMm`) but no further. Rotation is accounted for (rotated bounding box). | Matches real print practice; keeps content from being cut. |
| 7 | **Prices include tax?** | Catalogue prices are net; every quote returns net, tax and a tax-inclusive total (the headline price). Tax name/rate in `.env` (default GST 18%). | PRD says "VAT-inclusive totals" but the company is Indian -> GST. One switch changes it. |
| 8 | **Volume discounts** | Tiers per product (default floors at 100 / 500 / 1000 units). Highest tier reached applies to the whole quantity. | PRD example "from 100 units". |
| 9 | **Orientation** | Decides which side is the long side (landscape = width >= height). | Makes orientation a real parameter, not decoration. |
| 10 | **One order = one product** | No cart; each order is one configured job. | Every job has its own proofs/approval/files; simplest correct model for production. A cart can be added later by grouping orders. |
| 11 | **CSV merge** | Quantity = number of CSV rows (re-priced when CSV is uploaded, quote stage only). Fields missing from the CSV fall back to the element's default text; a CSV matching no fields is rejected. Output: one PDF (+PNG up to 200 rows) per row + manifest.csv. | "One artwork file per row" with no manual tweaking. |
| 12 | **Fitting rules** | 1) shrink-to-fit down to `minFontSize`, 2) tighten tracking down to `minTracking`, 3) otherwise flag overflow as an admin warning. | Exactly the PRD's three rules. |
| 13 | **Text in print files** | Converted to vector outlines using bundled fonts. | Identical output everywhere; no missing-font problems; PDF and PNG always match. |
| 14 | **`.ai` and PDF uploads** | Cannot be rasterised without Ghostscript/Poppler, so they are accepted, passed through to production unchanged, shown with a placeholder proof preview and flagged with a warning. PNG/SVG/JPG are fitted into the trim area. | Honest about a real technical limit. |
| 15 | **"Score / configuration of saved designs"** (typo in section 10) | Interpreted as the saved design's configuration (size, material, approval state). | Only sensible reading. |
| 16 | **Reorder** | Clones config, artwork and CSV at **today's prices** (flags `priceChanged`). If the original artwork was approved, the approval carries over (logged as `carried_over`) so no redesign is needed. | "One-click" reorder from saved artwork. |
| 17 | **Pipeline movement** | Forward one stage at a time (+ proof -> artwork for rework). Order/artwork/proof are automatic after payment; admin moves proof -> production -> completed. Cancel allowed up to the proof stage. | Predictable, auditable. |
| 18 | **Payments** | Stripe PaymentIntents + webhook; automatic MOCK provider when no key. Server recalculates price - client totals are never trusted. | PCI scope stays with Stripe; fully testable offline. |
| 19 | **Email** | Order confirmed, proof ready, proof approved, status change, completion, change-request (to admins), password reset. SMTP optional; failures never break a request. | PRD non-negotiable. |
| 20 | **Auth** | JWT bearer (7d) + bcrypt; registration always yields a customer; admins via seed/admin API; disabled users are blocked instantly (user is re-loaded per request). | Simple, secure, stateless. |
| 21 | **Xero** | `GET /api/admin/export/xero-invoices.csv` matches Xero's sales-invoice import columns. A full API integration can be added behind the same data shape. | "Xero-ready", switch on later. |
| 22 | **Corporate / multi-account** | `users.organizationId` reserved; all queries are per-user today. | Extensible without migration pain. |
