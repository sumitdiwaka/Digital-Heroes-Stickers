# Digital Heroes - Frontend (React + Vite + Tailwind)

Customer storefront, in-browser designer and admin production console for the Digital Heroes web-to-print backend.
Visual direction: **boutique industrial** - ink + warm paper, one copper accent for every call to action, sage for "approved / OK",
registration-mark details, and physical 3D motion (tilt cards, pressable buttons, a three.js hero, 3D page and modal entrances).

**Stack:** React 18 | Vite 5 | Tailwind 3 | React Router 6 | TanStack Query 5 | Framer Motion | three.js (hero only, lazy) | Lucide icons | Stripe Elements (optional)

## 1. Run it

```bash
# 1) start the backend first (see its README):  npm run seed && npm run dev      -> http://localhost:5000
# 2) then, in this folder:
npm install
cp .env.example .env        # optional in development
npm run dev                 # http://localhost:5173   (/api is proxied to the backend - no CORS setup needed)
```

Seeded logins (shown as one-click "Dev shortcuts" on the login page in development):
`customer@digitalheroes.test / Customer@12345` - `admin@digitalheroes.test / Admin@12345`

## 2. Scripts

| Command | What it does |
|---|---|
| `npm run dev` | dev server with hot reload |
| `npm run build` / `npm run preview` | production build in `dist/` / serve it locally |
| `npm run test:unit` | numerical tests of the designer maths (6,500+ checks incl. parity with the server) and the 3D hero scene (real three.js, stubbed GPU) |
| `npm run test:ui` | **UI integration test**: runs the real app in jsdom against the live backend and drives it like a user (66 checks: browse, price, register/login, designer, CSV, pay, proof approval, reorder, admin console). Needs the backend running and seeded. |

## 3. Pages

| Area | Routes |
|---|---|
| Public | `/` home (3D hero, division hub, live price calculator, how-it-works, gallery) - `/products` - `/division/:slug` - `/products/:slug` **configurator** (size / orientation / material / quantity, live price, volume tiers, design-or-upload) - `/gallery` - `/login` `/register` `/forgot-password` `/reset-password` |
| Customer | `/dashboard` (the 6 required modules) - `/orders` - `/orders/:id` (stepper, CSV merge, versioned proofs, approve / request changes, approval log, invoice, reorder) - `/checkout/:id` - `/designs` - `/profile` |
| Designer | `/designer/:productSlug?size=..&material=..&qty=..` new - `?design=ID` edit a saved design - `?order=ID` revise an order's artwork |
| Admin | `/admin` overview - `/admin/orders` searchable job pipeline - `/admin/orders/:id` job ticket (approval-gated files, zip download, regenerate, proofs, advance stages) - `/admin/users` - `/admin/catalogue` (products, divisions, gallery) - `/admin/reports` (+ Xero CSV) |

## 4. The designer

- SVG canvas in **millimetres**: dashed red **trim**, green **safe area**, hatched **bleed**. Text and logos are locked to the safe
  area, colour blocks may reach into the bleed - the same rules the server enforces (rotated bounding boxes included).
- Drag, resize (corner handles, correct for rotated elements), rotate (snaps to 15 degrees), centre-snapping guides, undo / redo,
  arrow-key nudging, duplicate, layer order. Works with mouse and touch.
- Per-element fitting rules (shrink-to-fit, min / max size, tracking) and CSV **merge fields**.
- The editor loads the same DejaVu fonts as the print engine (`public/fonts`), so text fits the same way; the **Preview** tab shows
  the true server-rendered proof.
- Live server validation (`POST /api/designs/validate`) with a clickable list of problems.

## 5. Performance and motion

- Route-level code splitting; three.js (~190 kB gzip) loads only for the hero, framer-motion is its own chunk.
- The hero pauses when off-screen or the tab is hidden, caps pixel ratio, and falls back to a CSS-3D version when WebGL is
  unavailable or the device is low-power. `prefers-reduced-motion` turns off tilt, floating and page transitions.
- Tilt/glare effects are mouse-only (no cost on touch devices).
- Heavy previews (saved-design thumbnails) render lazily when scrolled into view.

## 6. Responsiveness

Mobile-first layouts. Navigation becomes a slide-in drawer; tables become stacked cards; the configurator gets a sticky bottom
price bar; the designer stacks canvas above a tabbed panel on phones and uses three columns on desktop.

## 7. Deploying

1. **Backend** on a long-running Node host (Render / Railway / Fly / VPS) - see the backend README. Set its `CLIENT_URLS` to your frontend URL.
2. **Frontend** on Vercel (a new account, per the PRD), Netlify or any static host:
   - build command `npm run build`, output `dist`
   - environment: `VITE_API_URL=https://your-backend.example.com` (and `VITE_STRIPE_PUBLISHABLE_KEY` if the backend uses Stripe)
   - `vercel.json` / `public/_redirects` already contain the SPA rewrite so deep links like `/orders/123` work.
3. Never commit `.env`.

## 8. Notes

- Payments: with no Stripe key on the backend the checkout page shows a clearly labelled **test payment** card. In Stripe mode it
  renders Stripe's Payment Element (needs `VITE_STRIPE_PUBLISHABLE_KEY`; the order flips to "paid" via the backend webhook).
- Proof / asset images are fetched with the auth header and shown from blob URLs - tokens are never put in image URLs.
- Design tokens live in `tailwind.config.js` (colours, fonts, shadows) and `src/index.css` (3D loader, tilt, buttons).
