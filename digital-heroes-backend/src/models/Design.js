const mongoose = require('mongoose');

// One editable element on the canvas. Units: millimetres, origin = top-left of TRIM area.
const elementSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ['text', 'image', 'rect'], required: true },
    x: Number, y: Number, width: Number, height: Number,
    rotation: { type: Number, default: 0 },
    // text
    text: String,
    variableKey: String,                  // when set, value is replaced per CSV row
    fontFamily: { type: String, default: 'Helvetica' },
    fontWeight: { type: String, enum: ['normal', 'bold'], default: 'normal' },
    fontStyle: { type: String, enum: ['normal', 'italic'], default: 'normal' },
    fontSize: Number,                     // points (starting size)
    minFontSize: Number,
    maxFontSize: Number,
    tracking: { type: Number, default: 0 },
    minTracking: { type: Number, default: -1 },
    shrinkToFit: { type: Boolean, default: true },
    align: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
    color: { type: String, default: '#000000' },
    // image (logo)
    assetId: String,                      // id from POST /uploads/asset
    // rect
    fill: String, stroke: String, strokeWidth: Number,
  },
  { _id: false }
);

const designSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    template: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
    config: {
      widthMm: Number, heightMm: Number, sizeKey: String, material: String, orientation: String,
    },
    background: { type: String, default: '#FFFFFF' },
    elements: [elementSchema],
    source: { type: String, enum: ['editor', 'upload'], default: 'editor' },
    upload: {                              // when customer uploads finished artwork
      fileKey: String, originalName: String, mime: String, ext: String, size: Number,
    },
    approved: { type: Boolean, default: false },   // true once a proof using it was approved
    approvedAt: Date,
    approvedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  },
  { timestamps: true }
);
module.exports = mongoose.model('Design', designSchema);
