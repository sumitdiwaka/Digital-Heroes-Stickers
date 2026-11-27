const mongoose = require('mongoose');

// Pipeline: Quote -> Order -> Artwork -> Proof -> Production -> Completed  (+ cancelled)
const STATUSES = ['quote', 'order', 'artwork', 'proof', 'production', 'completed', 'cancelled'];

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, index: true },   // DH-YYMMDD-0001
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    division: { type: mongoose.Schema.Types.ObjectId, ref: 'Division', index: true },
    productName: String,        // snapshots (so later product edits never alter history)
    productType: String,
    divisionSlug: String,

    config: { widthMm: Number, heightMm: Number, sizeKey: String, material: String, orientation: String },
    quantity: { type: Number, required: true },
    printSpec: { bleedMm: Number, safeMarginMm: Number, dpi: Number },

    pricing: {
      currency: String,
      unitPriceMinor: Number,         // after volume discount
      listUnitPriceMinor: Number,     // before discount
      discountPct: Number,
      setupFeeMinor: Number,
      subtotalMinor: Number,          // net
      taxName: String, taxRate: Number, taxMinor: Number,
      totalMinor: Number,             // VAT/GST inclusive
    },

    // ---- artwork ----
    design: { type: mongoose.Schema.Types.ObjectId, ref: 'Design' },         // saved design it came from
    designSnapshot: {                                                         // frozen copy used for proofs + print
      source: String, background: String, elements: [mongoose.Schema.Types.Mixed],
      upload: { fileKey: String, originalName: String, mime: String, ext: String },
    },
    variableData: {                                                           // CSV merge
      fileKey: String, originalName: String, rowCount: Number, columns: [String],
    },

    // ---- workflow ----
    status: { type: String, enum: STATUSES, default: 'quote', index: true },
    statusHistory: [{ _id: false, status: String, at: { type: Date, default: Date.now }, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, note: String }],
    latestProofVersion: { type: Number, default: 0 },
    approvedProofVersion: { type: Number, default: null },
    filesUnlocked: { type: Boolean, default: false, index: true },            // THE APPROVAL GATE
    carryOverApproval: { type: Boolean, default: false },
    reorderOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },

    // ---- payment ----
    payment: {
      provider: { type: String, enum: ['stripe', 'mock', null], default: null },
      intentId: String,
      status: { type: String, enum: ['unpaid', 'pending', 'paid', 'failed', 'refunded'], default: 'unpaid' },
      paidAt: Date,
      invoiceNumber: String,
    },

    // ---- print output (admin only) ----
    printJob: {
      status: { type: String, enum: ['none', 'queued', 'running', 'done', 'failed'], default: 'none' },
      progress: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      error: String,
      startedAt: Date, finishedAt: Date,
      warnings: [String],
    },
    printFiles: [{ _id: false, name: String, key: String, type: { type: String }, size: Number, row: Number }], // NB: `type` must be wrapped, otherwise Mongoose reads it as a type declaration

    notes: String,
    archived: { type: Boolean, default: false, index: true },
    completedAt: Date,
  },
  { timestamps: true }
);
orderSchema.index({ createdAt: -1 });
orderSchema.statics.STATUSES = STATUSES;
module.exports = mongoose.model('Order', orderSchema);
