/** PUBLIC endpoints: catalogue, gallery, instant price calculator, designer helpers. */
const router = require('express').Router();
const mongoose = require('mongoose');
const { Division, Product, Template, Gallery } = require('../models');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { pricingQuote } = require('../validators');
const pricing = require('../services/pricing');
const designService = require('../services/designService');
const { FAMILIES } = require('../services/print/fonts');
const { notFound, bad } = require('../utils/AppError');
const env = require('../config/env');

const isId = (s) => mongoose.isValidObjectId(s);
const findProduct = async (idOrSlug) => {
  const p = await Product.findOne(isId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug }).populate('division');
  if (!p || !p.active) throw notFound('Product not found');
  p.divisionSlug = p.division.slug;
  return p;
};

// GET /api/divisions  - the six divisions (product hub tiles)
router.get('/divisions', asyncHandler(async (_req, res) => {
  const divisions = await Division.find({ active: true }).sort({ sortOrder: 1 });
  const counts = await Product.aggregate([{ $match: { active: true } }, { $group: { _id: '$division', n: { $sum: 1 } } }]);
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  res.json({ success: true, data: divisions.map((d) => ({ ...d.toObject(), productCount: map[String(d._id)] || 0 })) });
}));

// GET /api/products?division=<slug|id>&q=text
router.get('/products', asyncHandler(async (req, res) => {
  const filter = { active: true };
  if (req.query.division) {
    const d = await Division.findOne(isId(req.query.division) ? { _id: req.query.division } : { slug: req.query.division });
    if (!d) return res.json({ success: true, data: [] });
    filter.division = d._id;
  }
  if (req.query.q) filter.$text = { $search: String(req.query.q) };
  const products = await Product.find(filter).populate('division', 'slug name').sort({ sortOrder: 1, name: 1 });
  res.json({ success: true, data: products });
}));

// GET /api/products/:idOrSlug  - full configuration options for the configurator UI
router.get('/products/:idOrSlug', asyncHandler(async (req, res) => {
  const product = await findProduct(req.params.idOrSlug);
  const templates = await Template.find({ product: product._id, active: true }).select('name group background thumbnailUrl');
  res.json({ success: true, data: { product, templates, tax: { name: env.taxName, rate: env.taxRate }, currency: env.currency } });
}));

// POST /api/pricing/quote  - INSTANT PRICE CALCULATOR (public, stateless)
router.post('/pricing/quote', validate({ body: pricingQuote }), asyncHandler(async (req, res) => {
  const product = await findProduct(req.body.product);
  const result = pricing.calculate(product, req.body.config, req.body.quantity);
  res.json({ success: true, data: { product: { id: product._id, name: product.name }, ...result } });
}));

// GET /api/pricing/tiers/:idOrSlug - volume discount table for display
router.get('/pricing/tiers/:idOrSlug', asyncHandler(async (req, res) => {
  const product = await findProduct(req.params.idOrSlug);
  res.json({ success: true, data: { tiers: [{ minQty: 1, discountPct: 0 }, ...product.pricing.volumeTiers] } });
}));

// GET /api/gallery?division=<slug>  - live work gallery grouped by product family
router.get('/gallery', asyncHandler(async (req, res) => {
  const filter = { active: true };
  if (req.query.division) {
    const d = await Division.findOne({ slug: req.query.division });
    if (!d) return res.json({ success: true, data: [] });
    filter.division = d._id;
  }
  const items = await Gallery.find(filter).populate('division', 'slug name').sort({ sortOrder: 1 });
  const grouped = {};
  items.forEach((i) => { const k = i.division.slug; (grouped[k] = grouped[k] || { division: i.division, items: [] }).items.push(i); });
  res.json({ success: true, data: Object.values(grouped) });
}));

// GET /api/designer/fonts
router.get('/designer/fonts', (_req, res) => res.json({ success: true, data: { families: FAMILIES, weights: ['normal', 'bold'], styles: ['normal', 'italic'] } }));

// GET /api/templates/:id/instantiate?width=&height=  -> template placeholders as editable elements at real size
router.get('/templates/:id/instantiate', asyncHandler(async (req, res) => {
  const tpl = await Template.findById(req.params.id).populate('product');
  if (!tpl) throw notFound('Template not found');
  const product = tpl.product;
  const cfg = { sizeKey: req.query.sizeKey, widthMm: req.query.width, heightMm: req.query.height, material: req.query.material || product.materials[0].key, orientation: req.query.orientation };
  if (!cfg.sizeKey && !(cfg.widthMm && cfg.heightMm)) throw bad('Provide sizeKey or width + height');
  const resolved = pricing.resolveConfig(product, cfg);
  const elements = designService.instantiateTemplate(tpl, resolved.widthMm, resolved.heightMm, product.printSpec);
  res.json({ success: true, data: { background: tpl.background, trim: { widthMm: resolved.widthMm, heightMm: resolved.heightMm }, areas: designService.printAreas(resolved.widthMm, resolved.heightMm, product.printSpec), elements } });
}));

module.exports = router;
module.exports.findProduct = findProduct;
