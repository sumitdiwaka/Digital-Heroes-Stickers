# Database schema (MongoDB / Mongoose)

All money fields are integer minor units. All timestamps are ISO dates (`createdAt`, `updatedAt` via Mongoose).

| Collection | Purpose | Key fields | Indexes |
|---|---|---|---|
| **users** | Accounts (customer / admin) | name, email, passwordHash (bcrypt, never selected), role, phone, company, gstin, address, isActive, organizationId (future corporate accounts), passwordReset | email (unique), role |
| **divisions** | The six print ranges (add more without code) | slug, name, tagline, description, sortOrder, active | slug (unique) |
| **products** | ONE document models every variant | division, slug, productType, sizing{mode, presets[], minMm, maxWidthMm, maxHeightMm}, materials[{key, multiplier, surchargeMinor}], orientations, quantity{min,max,step}, supportsVariableData, pricing{basePerUnitMinor, pricePerCm2Minor, minUnitPriceMinor, setupFeeMinor, volumeTiers[{minQty, discountPct}]}, printSpec{bleedMm, safeMarginMm, dpi} | slug (unique), division, text(name, description) |
| **templates** | Starting layouts; geometry as fractions (0..1) so they scale to any size | product, name, group, background, placeholders[{key, type, x,y,w,h, defaultText, fontFamily, shrinkToFit, minFontSize, maxFontSize, tracking, minTracking}] | product |
| **designs** | Saved artwork on the customer account | user, product, template, config{widthMm,heightMm,material,orientation}, elements[], background, source (editor/upload), upload{fileKey,...}, approved, approvedAt, approvedOrder | user |
| **assets** | Logos uploaded inside the editor | user, fileKey, mime, ext, widthPx, heightPx | user |
| **orders** | One order = one configured product (a "job") | orderNumber (DH-YYMMDD-0001), user, product snapshot (name, type, divisionSlug), config, quantity, printSpec, pricing{...frozen price...}, designSnapshot (frozen artwork), variableData{fileKey,rowCount,columns}, status, statusHistory[], latestProofVersion, approvedProofVersion, **filesUnlocked** (approval gate), carryOverApproval, reorderOf, payment{provider,intentId,status,paidAt,invoiceNumber}, printJob{status,progress,total,warnings}, printFiles[{name,key,type,size,row}], archived | orderNumber (unique), user, status, division, filesUnlocked, archived, createdAt |
| **proofs** | Immutable proof revisions v1, v2, ... | order, version, previewKey, designHash, origin (generated / admin_upload / carried_over), status (pending / approved / changes_requested / superseded), changeRequestNote, decidedBy, decidedAt | (order, version) unique |
| **approvallogs** | Append-only audit trail | order, version, action (created / approved / changes_requested / carried_over), by, byName, byRole, note, ip, at | order |
| **galleries** | "Live work" gallery items | division, title, caption, imageUrl, tags, sortOrder, active | division |
| **counters** | Atomic sequences for order and invoice numbers | _id, seq | - |

## Relationships

```
Division 1---* Product 1---* Template
User 1---* Design *---1 Product
User 1---* Order *---1 Product        Order 1---* Proof        Order 1---* ApprovalLog
Order *---0..1 Design (source)        Order 0..1---1 Order (reorderOf)
```

## Why orders store snapshots
`productName`, `config`, `pricing`, `printSpec` and `designSnapshot` are copied onto the order. Later edits to a product's
price or to the customer's saved design never change history, proofs or invoices. Products and divisions are only
ever soft-deleted (`active:false`) for the same reason.

## Files on disk (`STORAGE_DIR`)
```
assets/<userId>/<uuid>.png          logos used in the editor
artwork/<userId>/<uuid>.pdf|svg|... customer-uploaded finished artwork
csv/<orderId>.csv                   CSV variable data
proofs/<orderId>/v1.png, v2.png     proof previews
orders/<OrderID>/<OrderID>_<ProductType>_<YYYYMMDD>_<Output>.<ext>   print files
```
