/**
 * Seed script:  npm run seed         (adds missing data, safe to re-run)
 *               npm run seed:reset   (WIPES the database first)
 * Creates: admin + customer accounts, the six divisions, parameter-driven products, templates, gallery items.
 * All prices are in MINOR units (paise): 100 = INR 1.00.
 */
const env = require('../src/config/env');
const connectDB = require('../src/config/db');
const mongoose = require('mongoose');
const { User, Division, Product, Template, Gallery } = require('../src/models');

const dns = require("node:dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const tiers = (a, b, c) => [{ minQty: 100, discountPct: a }, { minQty: 500, discountPct: b }, { minQty: 1000, discountPct: c }];
const DIVISIONS = [
  { slug: 'labels-stickers', name: 'Labels & Stickers', tagline: 'Any shape, any run', sortOrder: 1, description: 'Custom labels and stickers in paper, vinyl and clear film.' },
  { slug: 'race-event-numbers', name: 'Race & Event Numbers', tagline: 'Bibs with variable data', sortOrder: 2, description: 'Race numbers and bibs, bulk-generated from a CSV.' },
  { slug: 'mtb-boards', name: 'MTB Boards', tagline: 'Number boards that survive mud', sortOrder: 3, description: 'Mountain-bike number plates and boards.' },
  { slug: 'stamps', name: 'Stamps', tagline: 'Crisp impressions', sortOrder: 4, description: 'Self-inking and pre-inked custom stamps.' },
  { slug: 'trophies', name: 'Trophies', tagline: 'Engraved to order', sortOrder: 5, description: 'Trophy plates and engraved awards.' },
  { slug: 'laser-cut', name: 'Laser-Cut Work', tagline: 'Precision cut shapes', sortOrder: 6, description: 'Laser-cut acrylic, wood and MDF pieces.' },
];

const PRODUCTS = (d) => [
  {
    division: d['labels-stickers']._id, slug: 'custom-stickers', name: 'Custom Stickers & Labels', productType: 'stickers',
    description: 'Die-cut or rectangular stickers. Choose any size from 20mm to 300mm.',
    sizing: { mode: 'both', minMm: 20, maxWidthMm: 300, maxHeightMm: 300, presets: [{ key: '50x50', label: '50 x 50 mm', widthMm: 50, heightMm: 50 }, { key: '100x50', label: '100 x 50 mm', widthMm: 100, heightMm: 50 }, { key: '100x100', label: '100 x 100 mm', widthMm: 100, heightMm: 100 }] },
    materials: [{ key: 'paper-gloss', label: 'Gloss paper', multiplier: 1 }, { key: 'vinyl-white', label: 'White vinyl', multiplier: 1.4, surchargeMinor: 50 }, { key: 'vinyl-clear', label: 'Clear vinyl', multiplier: 1.6, surchargeMinor: 80 }],
    quantity: { min: 25, max: 50000 },
    pricing: { basePerUnitMinor: 300, pricePerCm2Minor: 8, minUnitPriceMinor: 400, setupFeeMinor: 15000, volumeTiers: tiers(5, 12, 20) },
    printSpec: { bleedMm: 2, safeMarginMm: 2, dpi: 300 }, sortOrder: 1,
  },
  {
    division: d['race-event-numbers']._id, slug: 'race-bibs', name: 'Race & Event Numbers', productType: 'race-numbers',
    description: 'Tear-resistant bibs. Upload a CSV and we generate one artwork per runner.',
    sizing: { mode: 'fixed', presets: [{ key: 'bib-190x140', label: 'Standard bib 190 x 140 mm', widthMm: 190, heightMm: 140 }, { key: 'bib-150x100', label: 'Compact bib 150 x 100 mm', widthMm: 150, heightMm: 100 }] },
    materials: [{ key: 'tyvek', label: 'Tyvek (tear-proof)', multiplier: 1.3 }, { key: 'paper-coated', label: 'Coated paper', multiplier: 1 }],
    orientations: ['landscape'], quantity: { min: 10, max: 5000 }, supportsVariableData: true,
    pricing: { basePerUnitMinor: 500, pricePerCm2Minor: 2, minUnitPriceMinor: 600, setupFeeMinor: 25000, volumeTiers: tiers(4, 10, 15) },
    printSpec: { bleedMm: 3, safeMarginMm: 5, dpi: 200 }, sortOrder: 2,
  },
  {
    division: d['mtb-boards']._id, slug: 'mtb-number-board', name: 'MTB Number Board', productType: 'mtb-boards',
    description: 'Weatherproof number boards for handlebars.',
    sizing: { mode: 'fixed', presets: [{ key: 'mtb-230x190', label: 'Standard 230 x 190 mm', widthMm: 230, heightMm: 190 }, { key: 'mtb-200x160', label: 'Junior 200 x 160 mm', widthMm: 200, heightMm: 160 }] },
    materials: [{ key: 'coroplast-4mm', label: 'Coroplast 4mm', multiplier: 1 }, { key: 'pvc-3mm', label: 'PVC foam 3mm', multiplier: 1.25 }],
    orientations: ['landscape', 'portrait'], quantity: { min: 5, max: 3000 }, supportsVariableData: true,
    pricing: { basePerUnitMinor: 1800, pricePerCm2Minor: 3, minUnitPriceMinor: 2000, setupFeeMinor: 20000, volumeTiers: tiers(5, 10, 18) },
    printSpec: { bleedMm: 3, safeMarginMm: 6, dpi: 200 }, sortOrder: 3,
  },
  {
    division: d['stamps']._id, slug: 'self-inking-stamp', name: 'Self-Inking Stamp', productType: 'stamps',
    description: 'Custom text and logo stamps in popular sizes.',
    sizing: { mode: 'fixed', presets: [{ key: '38x14', label: '38 x 14 mm', widthMm: 38, heightMm: 14 }, { key: '47x18', label: '47 x 18 mm', widthMm: 47, heightMm: 18 }, { key: '58x22', label: '58 x 22 mm', widthMm: 58, heightMm: 22 }, { key: '40x40', label: '40 x 40 mm', widthMm: 40, heightMm: 40 }] },
    materials: [{ key: 'black-ink', label: 'Black ink', multiplier: 1 }, { key: 'blue-ink', label: 'Blue ink', multiplier: 1 }, { key: 'red-ink', label: 'Red ink', multiplier: 1 }],
    quantity: { min: 1, max: 500 },
    pricing: { basePerUnitMinor: 25000, pricePerCm2Minor: 40, minUnitPriceMinor: 28000, setupFeeMinor: 0, volumeTiers: [{ minQty: 10, discountPct: 5 }, { minQty: 50, discountPct: 12 }, { minQty: 100, discountPct: 18 }] },
    printSpec: { bleedMm: 1, safeMarginMm: 1, dpi: 600 }, sortOrder: 4,
  },
  {
    division: d['trophies']._id, slug: 'engraved-trophy-plate', name: 'Engraved Trophy Plate', productType: 'trophies',
    description: 'Engraved plates for trophies and awards.',
    sizing: { mode: 'both', minMm: 30, maxWidthMm: 200, maxHeightMm: 120, presets: [{ key: 'plate-80x30', label: '80 x 30 mm', widthMm: 80, heightMm: 30 }, { key: 'plate-100x50', label: '100 x 50 mm', widthMm: 100, heightMm: 50 }] },
    materials: [{ key: 'brass', label: 'Brushed brass', multiplier: 1.6, surchargeMinor: 2000 }, { key: 'acrylic', label: 'Acrylic', multiplier: 1.1 }, { key: 'wood', label: 'Walnut wood', multiplier: 1.3, surchargeMinor: 1500 }],
    orientations: ['landscape', 'portrait'], quantity: { min: 1, max: 1000 },
    pricing: { basePerUnitMinor: 15000, pricePerCm2Minor: 60, minUnitPriceMinor: 18000, setupFeeMinor: 5000, volumeTiers: [{ minQty: 10, discountPct: 6 }, { minQty: 50, discountPct: 14 }, { minQty: 100, discountPct: 20 }] },
    printSpec: { bleedMm: 1, safeMarginMm: 3, dpi: 600 }, sortOrder: 5,
  },
  {
    division: d['laser-cut']._id, slug: 'laser-cut-shapes', name: 'Laser-Cut Shapes', productType: 'laser-cut',
    description: 'Custom laser-cut pieces in acrylic, plywood and MDF.',
    sizing: { mode: 'custom', minMm: 20, maxWidthMm: 600, maxHeightMm: 400, presets: [] },
    materials: [{ key: 'acrylic-3mm', label: 'Acrylic 3mm', multiplier: 1.5 }, { key: 'plywood-3mm', label: 'Birch plywood 3mm', multiplier: 1.1 }, { key: 'mdf-3mm', label: 'MDF 3mm', multiplier: 1 }],
    quantity: { min: 1, max: 5000 },
    pricing: { basePerUnitMinor: 2500, pricePerCm2Minor: 12, minUnitPriceMinor: 3000, setupFeeMinor: 10000, volumeTiers: tiers(5, 12, 20) },
    printSpec: { bleedMm: 0, safeMarginMm: 2, dpi: 300 }, sortOrder: 6,
  },
];

const TEMPLATES = (p) => [
  { product: p['race-bibs']._id, name: 'Classic bib', group: 'race', background: '#FFFFFF', placeholders: [
    { key: 'band', type: 'shape', x: 0, y: 0, w: 1, h: 0.2, fill: '#E11D48' },
    { key: 'event', type: 'text', defaultText: 'CITY 10K 2026', x: 0.05, y: 0.06, w: 0.9, h: 0.12, fontFamily: 'Condensed', color: '#FFFFFF', minFontSize: 8, maxFontSize: 40 },
    { key: 'number', type: 'text', defaultText: '1234', x: 0.05, y: 0.25, w: 0.9, h: 0.5, fontFamily: 'Condensed', color: '#111111', minFontSize: 30, maxFontSize: 400 },
    { key: 'name', type: 'text', defaultText: 'RUNNER NAME', x: 0.05, y: 0.8, w: 0.9, h: 0.14, fontFamily: 'Sans', color: '#111111', minFontSize: 6, maxFontSize: 40, minTracking: -1.5 },
  ] },
  { product: p['mtb-number-board']._id, name: 'Rider board', group: 'mtb', background: '#FFD400', placeholders: [
    { key: 'number', type: 'text', defaultText: '42', x: 0.08, y: 0.1, w: 0.84, h: 0.62, fontFamily: 'Condensed', color: '#000000', minFontSize: 40, maxFontSize: 500 },
    { key: 'rider', type: 'text', defaultText: 'RIDER NAME', x: 0.08, y: 0.76, w: 0.84, h: 0.16, fontFamily: 'Sans', color: '#000000', minFontSize: 8, maxFontSize: 60 },
  ] },
  { product: p['custom-stickers']._id, name: 'Simple label', group: 'general', background: '#FFFFFF', placeholders: [
    { key: 'headline', type: 'text', defaultText: 'YOUR BRAND', x: 0.1, y: 0.15, w: 0.8, h: 0.4, fontFamily: 'Sans', color: '#111111', minFontSize: 6, maxFontSize: 80 },
    { key: 'tagline', type: 'text', defaultText: 'tagline here', x: 0.1, y: 0.6, w: 0.8, h: 0.22, fontFamily: 'Serif', fontWeight: 'normal', color: '#555555', minFontSize: 5, maxFontSize: 30 },
  ] },
  { product: p['engraved-trophy-plate']._id, name: 'Award plate', group: 'awards', background: '#C9A24B', placeholders: [
    { key: 'title', type: 'text', defaultText: 'CHAMPION', x: 0.08, y: 0.1, w: 0.84, h: 0.4, fontFamily: 'Serif', color: '#2B1D00', minFontSize: 6, maxFontSize: 60 },
    { key: 'recipient', type: 'text', defaultText: 'Recipient Name', x: 0.08, y: 0.58, w: 0.84, h: 0.28, fontFamily: 'Serif', fontWeight: 'normal', color: '#2B1D00', minFontSize: 5, maxFontSize: 40 },
  ] },
];

(async () => {
  await connectDB();
  if (process.argv.includes('--reset')) { await mongoose.connection.dropDatabase(); console.log('[seed] database wiped'); }

  const upsertUser = async (email, name, role, password) => {
    let u = await User.findOne({ email });
    if (!u) { u = new User({ email, name, role }); await u.setPassword(password); await u.save(); console.log(`[seed] created ${role}: ${email}`); }
    return u;
  };
  await upsertUser(process.env.SEED_ADMIN_EMAIL || 'admin@digitalheroes.test', 'Hero Admin', 'admin', process.env.SEED_ADMIN_PASSWORD || 'Admin@12345');
  await upsertUser(process.env.SEED_CUSTOMER_EMAIL || 'customer@digitalheroes.test', 'Test Customer', 'customer', process.env.SEED_CUSTOMER_PASSWORD || 'Customer@12345');

  const dmap = {};
  for (const d of DIVISIONS) dmap[d.slug] = await Division.findOneAndUpdate({ slug: d.slug }, d, { upsert: true, new: true, setDefaultsOnInsert: true });

  const pmap = {};
  for (const p of PRODUCTS(dmap)) pmap[p.slug] = await Product.findOneAndUpdate({ slug: p.slug }, p, { upsert: true, new: true, setDefaultsOnInsert: true });

  for (const t of TEMPLATES(pmap)) await Template.findOneAndUpdate({ product: t.product, name: t.name }, t, { upsert: true, setDefaultsOnInsert: true });

  if (!(await Gallery.countDocuments())) {
    const g = (slug, title, caption) => ({ division: dmap[slug]._id, title, caption, imageUrl: `https://placehold.co/800x600?text=${encodeURIComponent(title)}`, tags: [slug] });
    await Gallery.insertMany([
      g('labels-stickers', 'Craft beer labels', 'Vinyl labels, 500 run'), g('labels-stickers', 'Product seals', 'Clear vinyl'),
      g('race-event-numbers', 'City 10K bibs', '3,200 unique numbers via CSV'), g('mtb-boards', 'Enduro series boards', 'Coroplast'),
      g('stamps', 'Studio stamps', 'Self-inking'), g('trophies', 'League trophies', 'Brass engraving'), g('laser-cut', 'Acrylic signage', '3mm acrylic'),
    ]);
  }
  console.log('[seed] done. Divisions:', Object.keys(dmap).length, '| Products:', Object.keys(pmap).length);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
