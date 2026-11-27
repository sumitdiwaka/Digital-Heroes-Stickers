/** Designer backend: asset uploads, designs (saved artwork), print-area validation, previews. */
const router = require('express').Router();
const crypto = require('crypto');
const sharp = require('sharp');
const { Design, Asset, Product, Template } = require('../models');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const { design: v, objectId, z } = require('../validators');
const pricing = require('../services/pricing');
const designService = require('../services/designService');
const printService = require('../services/printService');
const storage = require('../services/storage');
const { notFound, bad, conflict } = require('../utils/AppError');
const { findProduct } = require('./catalogue');

router.use(['/designs', '/uploads'], requireAuth); // scoped so it never gates other /api routes

const idParam = z.object({ id: objectId });
const publicConfig = (product, cfg) => { const { _material, ...c } = pricing.resolveConfig(product, cfg); return c; };
const specOf = (product) => ({ bleedMm: product.printSpec.bleedMm, safeMarginMm: product.printSpec.safeMarginMm, dpi: product.printSpec.dpi });

async function ownDesign(req) {
  const d = await Design.findOne({ _id: req.params.id, user: req.user._id });
  if (!d) throw notFound('Design not found');
  return d;
}

// ---------------------------------------------------------------- logo / image assets used INSIDE the editor
// POST /api/uploads/asset   (multipart: file=png|jpg|svg)
router.post('/uploads/asset', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw bad('Attach a file in the "file" field');
  const t = upload.sniff(req.file.buffer, req.file.originalname);
  if (!t || !['png', 'jpg', 'svg'].includes(t.ext)) throw bad('Logos must be PNG, JPG or SVG');
  let meta;
  try { meta = await sharp(req.file.buffer).metadata(); } catch { throw bad('Image could not be read'); }
  const key = `assets/${req.user._id}/${crypto.randomUUID()}.${t.ext}`;
  await storage.put(key, req.file.buffer);
  const asset = await Asset.create({ user: req.user._id, fileKey: key, originalName: req.file.originalname, mime: t.mime, ext: t.ext, size: req.file.size, widthPx: meta.width, heightPx: meta.height });
  res.status(201).json({ success: true, data: { id: asset._id, originalName: asset.originalName, ext: asset.ext, widthPx: asset.widthPx, heightPx: asset.heightPx, url: `/api/uploads/asset/${asset._id}` } });
}));

// GET /api/uploads/asset/:id  (owner only)
router.get('/uploads/asset/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const a = await Asset.findOne({ _id: req.params.id, user: req.user._id });
  if (!a) throw notFound('Asset not found');
  res.type(a.mime); storage.stream(a.fileKey).pipe(res);
}));

// ---------------------------------------------------------------- validation (live, no save)
// POST /api/designs/validate   -> tells the editor exactly which elements are outside the print area
router.post('/designs/validate', validate({ body: v.validate }), asyncHandler(async (req, res) => {
  const product = await findProduct(req.body.product);
  const cfg = publicConfig(product, req.body.config);
  const result = await designService.validateElements(req.body.elements, { trimW: cfg.widthMm, trimH: cfg.heightMm, spec: specOf(product), userId: req.user._id });
  res.json({ success: true, data: { ...result, trim: { widthMm: cfg.widthMm, heightMm: cfg.heightMm } } });
}));

// ---------------------------------------------------------------- CRUD
// POST /api/designs
router.post('/designs', validate({ body: v.create }), asyncHandler(async (req, res) => {
  const product = await findProduct(req.body.product);
  const cfg = publicConfig(product, req.body.config);
  if (req.body.template && !(await Template.exists({ _id: req.body.template, product: product._id }))) throw bad('Template does not belong to this product');
  const check = await designService.validateElements(req.body.elements, { trimW: cfg.widthMm, trimH: cfg.heightMm, spec: specOf(product), userId: req.user._id });
  if (!check.valid) return res.status(422).json({ success: false, error: { code: 'OUTSIDE_PRINT_AREA', message: 'Some elements are outside the printable area', details: check.errors } });
  const d = await Design.create({ user: req.user._id, name: req.body.name, product: product._id, template: req.body.template, config: cfg, background: req.body.background, elements: req.body.elements });
  res.status(201).json({ success: true, data: { design: d, warnings: check.warnings } });
}));

// GET /api/designs?approved=true&product=<id>
router.get('/designs', asyncHandler(async (req, res) => {
  const f = { user: req.user._id };
  if (req.query.approved === 'true') f.approved = true;
  if (req.query.product) f.product = req.query.product;
  const designs = await Design.find(f).populate('product', 'name slug productType').sort({ updatedAt: -1 });
  res.json({ success: true, data: designs });
}));

router.get('/designs/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await (await ownDesign(req)).populate('product', 'name slug productType') });
}));

// PATCH /api/designs/:id
router.patch('/designs/:id', validate({ params: idParam, body: v.update }), asyncHandler(async (req, res) => {
  const d = await ownDesign(req);
  const product = await Product.findById(d.product);
  if (req.body.name) d.name = req.body.name;
  if (req.body.background) d.background = req.body.background;
  if (req.body.config) d.config = publicConfig(product, req.body.config);
  if (req.body.elements) {
    if (d.source === 'upload') throw conflict('This design is an uploaded file; it has no editable elements');
    d.elements = req.body.elements;
  }
  const check = await designService.validateElements(d.elements.map((e) => e.toObject()), { trimW: d.config.widthMm, trimH: d.config.heightMm, spec: specOf(product), userId: req.user._id });
  if (!check.valid) return res.status(422).json({ success: false, error: { code: 'OUTSIDE_PRINT_AREA', message: 'Some elements are outside the printable area', details: check.errors } });
  await d.save();
  res.json({ success: true, data: { design: d, warnings: check.warnings } });
}));

router.delete('/designs/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const d = await ownDesign(req);
  await d.deleteOne();
  res.json({ success: true, data: { deleted: true } });
}));

// POST /api/designs/:id/artwork  (multipart: file=pdf|svg|ai|png)  - "upload path": finished artwork instead of the editor
router.post('/designs/:id/artwork', validate({ params: idParam }), upload.single('file'), asyncHandler(async (req, res) => {
  const d = await ownDesign(req);
  if (!req.file) throw bad('Attach a file in the "file" field');
  const t = upload.sniff(req.file.buffer, req.file.originalname);
  if (!t || !['pdf', 'ai', 'svg', 'png', 'jpg'].includes(t.ext)) throw bad('Artwork must be PDF, SVG, AI or PNG');
  const key = `artwork/${req.user._id}/${crypto.randomUUID()}.${t.ext}`;
  await storage.put(key, req.file.buffer);
  d.source = 'upload'; d.elements = [];
  d.upload = { fileKey: key, originalName: req.file.originalname, mime: t.mime, ext: t.ext, size: req.file.size };
  await d.save();
  res.status(201).json({ success: true, data: { design: d, note: ['pdf', 'ai'].includes(t.ext) ? 'PDF/AI files are accepted and passed through to production; the preview is a placeholder.' : undefined } });
}));

// GET /api/designs/:id/preview.png  -> real-time proof preview of the current design (trim line + watermark)
router.get('/designs/:id/preview.png', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const d = await ownDesign(req);
  const product = await Product.findById(d.product);
  const pseudoOrder = {
    user: req.user._id, productName: product.name,
    config: d.config, printSpec: specOf(product),
    designSnapshot: designService.snapshotOf(d),
  };
  const vars = {};
  Object.entries(req.query).forEach(([k, val]) => { if (/^var_/.test(k)) vars[k.slice(4)] = val; }); // ?var_name=Sam  -> try variable text live
  const png = await printService.renderProofPreview(pseudoOrder, 0, vars, 'PREVIEW');
  res.type('png').send(png);
}));

module.exports = router;
