const mongoose = require('mongoose');

/**
 * Template = starting layout for a product. Placeholder geometry is stored as FRACTIONS (0..1)
 * of the trim size, so the same template scales to any dynamic size.
 */
const placeholderSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },            // variable key, also CSV column name
    type: { type: String, enum: ['text', 'image', 'shape'], default: 'text' },
    label: String,
    x: Number, y: Number, w: Number, h: Number,       // fractions of trim width/height
    defaultText: String,
    fontFamily: { type: String, default: 'Helvetica' },
    fontWeight: { type: String, default: 'bold' },
    color: { type: String, default: '#000000' },
    align: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
    // per-placeholder fitting rules
    shrinkToFit: { type: Boolean, default: true },
    minFontSize: { type: Number, default: 6 },        // points
    maxFontSize: { type: Number, default: 72 },
    tracking: { type: Number, default: 0 },           // letter spacing in points
    minTracking: { type: Number, default: -1 },
    fill: String,
  },
  { _id: false }
);

const templateSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    name: { type: String, required: true },
    group: { type: String, default: 'general' },      // template group (scalability)
    background: { type: String, default: '#FFFFFF' },
    placeholders: [placeholderSchema],
    thumbnailUrl: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
module.exports = mongoose.model('Template', templateSchema);
