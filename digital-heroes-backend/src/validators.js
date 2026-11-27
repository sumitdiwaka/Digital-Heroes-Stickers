const { z } = require('zod');
const { FAMILIES } = require('./services/print/fonts');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const hexColor = z.string().regex(/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/, 'Use #RGB or #RRGGBB');
const strongPassword = z.string().min(8, 'At least 8 characters').max(100).regex(/[A-Za-z]/, 'Needs a letter').regex(/\d/, 'Needs a number');

const auth = {
  register: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email(),
    password: strongPassword,
    phone: z.string().trim().max(30).optional(),
    company: z.string().trim().max(120).optional(),
  }),
  login: z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }),
  profile: z.object({
    name: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().max(30).optional(),
    company: z.string().trim().max(120).optional(),
    gstin: z.string().trim().max(30).optional(),
    address: z.object({ line1: z.string().max(200).optional(), line2: z.string().max(200).optional(), city: z.string().max(80).optional(), state: z.string().max(80).optional(), postalCode: z.string().max(20).optional(), country: z.string().max(2).optional() }).optional(),
  }).strict(),
  changePassword: z.object({ currentPassword: z.string().min(1), newPassword: strongPassword }),
  forgot: z.object({ email: z.string().trim().toLowerCase().email() }),
  reset: z.object({ token: z.string().min(10), newPassword: strongPassword }),
};

const config = z.object({
  sizeKey: z.string().max(50).optional(),
  widthMm: z.coerce.number().positive().max(5000).optional(),
  heightMm: z.coerce.number().positive().max(5000).optional(),
  material: z.string().min(1).max(50),
  orientation: z.enum(['landscape', 'portrait']).optional(),
});

const element = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(['text', 'image', 'rect']),
  x: z.number(), y: z.number(),
  width: z.number().positive().max(5000), height: z.number().positive().max(5000),
  rotation: z.number().min(-360).max(360).optional().default(0),
  text: z.string().max(500).optional(),
  variableKey: z.string().regex(/^[A-Za-z0-9_]{1,40}$/).optional(),
  fontFamily: z.enum(FAMILIES).optional(),
  fontWeight: z.enum(['normal', 'bold']).optional(),
  fontStyle: z.enum(['normal', 'italic']).optional(),
  fontSize: z.number().min(1).max(1500).optional(),
  minFontSize: z.number().min(1).max(1500).optional(),
  maxFontSize: z.number().min(1).max(1500).optional(),
  tracking: z.number().min(-20).max(100).optional(),
  minTracking: z.number().min(-20).max(0).optional(),
  shrinkToFit: z.boolean().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  color: hexColor.optional(),
  assetId: objectId.optional(),
  fill: hexColor.optional(), stroke: hexColor.optional(), strokeWidth: z.number().min(0).max(50).optional(),
}).strict().refine((e) => e.minFontSize === undefined || e.maxFontSize === undefined || e.minFontSize <= e.maxFontSize, { message: 'minFontSize must be <= maxFontSize' });

const elements = z.array(element).max(200);

const design = {
  create: z.object({
    name: z.string().trim().min(1).max(120),
    product: objectId, template: objectId.optional(),
    config, background: hexColor.optional(), elements: elements.default([]),
  }),
  update: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    config: config.optional(), background: hexColor.optional(), elements: elements.optional(),
  }).strict(),
  validate: z.object({ product: objectId, config, elements }),
};

const pricingQuote = z.object({
  product: z.string().min(1),               // id OR slug
  config,
  quantity: z.coerce.number().int().positive(),
});

const order = {
  create: z.object({
    product: z.string().min(1), config, quantity: z.coerce.number().int().positive(),
    design: objectId.optional(), notes: z.string().max(500).optional(),
  }),
  artwork: z.object({ design: objectId.optional(), elements: elements.optional(), background: hexColor.optional() }).refine((b) => b.design || b.elements, { message: 'Provide design (saved design id) or elements' }),
  reorder: z.object({ quantity: z.coerce.number().int().positive().optional(), checkout: z.boolean().optional() }),
  requestChanges: z.object({ note: z.string().trim().min(3).max(1000) }),
  version: z.object({ id: objectId, version: z.coerce.number().int().positive() }),
};

const admin = {
  userUpdate: z.object({ role: z.enum(['customer', 'admin']).optional(), isActive: z.boolean().optional(), name: z.string().trim().min(2).max(120).optional() }).strict(),
  advance: z.object({ toStatus: z.enum(['order', 'artwork', 'proof', 'production', 'completed', 'cancelled']).optional(), note: z.string().max(500).optional() }),
  division: z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(2), tagline: z.string().optional(), description: z.string().optional(),
    imageUrl: z.string().url().optional(), sortOrder: z.number().int().optional(), active: z.boolean().optional(),
  }),
  product: z.object({
    division: objectId, slug: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(2), productType: z.string().regex(/^[a-z0-9-]+$/),
    description: z.string().optional(), images: z.array(z.string()).optional(), active: z.boolean().optional(),
    sizing: z.object({
      mode: z.enum(['fixed', 'custom', 'both']),
      presets: z.array(z.object({ key: z.string(), label: z.string(), widthMm: z.number().positive(), heightMm: z.number().positive() })).default([]),
      minMm: z.number().positive().optional(), maxWidthMm: z.number().positive().optional(), maxHeightMm: z.number().positive().optional(),
    }),
    materials: z.array(z.object({ key: z.string(), label: z.string(), multiplier: z.number().positive().default(1), surchargeMinor: z.number().int().min(0).default(0), active: z.boolean().optional() })).min(1),
    orientations: z.array(z.enum(['landscape', 'portrait'])).min(1).optional(),
    quantity: z.object({ min: z.number().int().positive(), max: z.number().int().positive(), step: z.number().int().positive().optional() }).optional(),
    supportsVariableData: z.boolean().optional(),
    pricing: z.object({
      basePerUnitMinor: z.number().int().min(0), pricePerCm2Minor: z.number().min(0), minUnitPriceMinor: z.number().int().min(0).optional(),
      setupFeeMinor: z.number().int().min(0).optional(),
      volumeTiers: z.array(z.object({ minQty: z.number().int().positive(), discountPct: z.number().min(0).max(90) })).default([]),
    }),
    printSpec: z.object({ bleedMm: z.number().min(0).max(20), safeMarginMm: z.number().min(0).max(30), dpi: z.number().int().min(72).max(1200) }).optional(),
    sortOrder: z.number().int().optional(),
  }),
  template: z.object({
    product: objectId, name: z.string().min(2), group: z.string().optional(), background: hexColor.optional(), thumbnailUrl: z.string().optional(), active: z.boolean().optional(),
    placeholders: z.array(z.object({
      key: z.string().regex(/^[A-Za-z0-9_]{1,40}$/), type: z.enum(['text', 'image', 'shape']).optional(), label: z.string().optional(),
      x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0).max(1), h: z.number().min(0).max(1),
      defaultText: z.string().optional(), fontFamily: z.enum(FAMILIES).optional(), fontWeight: z.enum(['normal', 'bold']).optional(),
      color: hexColor.optional(), align: z.enum(['left', 'center', 'right']).optional(), shrinkToFit: z.boolean().optional(),
      minFontSize: z.number().positive().optional(), maxFontSize: z.number().positive().optional(), tracking: z.number().optional(), minTracking: z.number().optional(), fill: hexColor.optional(),
    })).min(1),
  }),
  gallery: z.object({ division: objectId, title: z.string().min(1), caption: z.string().optional(), imageUrl: z.string().min(1), tags: z.array(z.string()).optional(), sortOrder: z.number().int().optional(), active: z.boolean().optional() }),
};

module.exports = { auth, config, design, pricingQuote, order, admin, objectId, z };
