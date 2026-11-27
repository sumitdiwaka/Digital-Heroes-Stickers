const mongoose = require('mongoose');

const tierSchema = new mongoose.Schema(
  { minQty: { type: Number, required: true, min: 1 }, discountPct: { type: Number, required: true, min: 0, max: 90 } },
  { _id: false }
);

/**
 * PARAMETER-DRIVEN product: one document models every size / material / orientation / quantity.
 * No SKU-per-size. Pricing + print spec live on the product, so admin edits them without code.
 */
const productSchema = new mongoose.Schema(
  {
    division: { type: mongoose.Schema.Types.ObjectId, ref: 'Division', required: true, index: true },
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    productType: { type: String, required: true }, // used in file naming, e.g. "stickers"
    description: String,
    images: [String],
    active: { type: Boolean, default: true },

    // ---- configurable parameters ----
    sizing: {
      mode: { type: String, enum: ['fixed', 'custom', 'both'], default: 'both' },
      presets: [{ _id: false, key: String, label: String, widthMm: Number, heightMm: Number }],
      minMm: { type: Number, default: 10 },
      maxWidthMm: { type: Number, default: 1000 },
      maxHeightMm: { type: Number, default: 1000 },
    },
    materials: [
      { _id: false, key: { type: String, required: true }, label: String,
        multiplier: { type: Number, default: 1 },          // multiplies area-based price
        surchargeMinor: { type: Number, default: 0 },      // flat extra per unit
        active: { type: Boolean, default: true } },
    ],
    orientations: { type: [String], default: ['landscape', 'portrait'] },
    quantity: { min: { type: Number, default: 1 }, max: { type: Number, default: 100000 }, step: { type: Number, default: 1 } },
    supportsVariableData: { type: Boolean, default: false }, // CSV merge (race numbers, bulk jobs)

    // ---- pricing (minor units) ----
    pricing: {
      basePerUnitMinor: { type: Number, default: 0 },
      pricePerCm2Minor: { type: Number, default: 0 },
      minUnitPriceMinor: { type: Number, default: 0 },
      setupFeeMinor: { type: Number, default: 0 },
      volumeTiers: [tierSchema],
    },

    // ---- production spec ----
    printSpec: {
      bleedMm: { type: Number, default: 3 },
      safeMarginMm: { type: Number, default: 3 },
      dpi: { type: Number, default: 300 },
      colorMode: { type: String, default: 'RGB' },
    },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);
productSchema.index({ name: 'text', description: 'text' });
module.exports = mongoose.model('Product', productSchema);
