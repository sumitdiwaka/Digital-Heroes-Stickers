const mongoose = require('mongoose');

// Append-only audit trail: WHO did WHAT to WHICH proof version and WHEN.
const logSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    version: { type: Number, required: true },
    action: { type: String, enum: ['created', 'approved', 'changes_requested', 'carried_over'], required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byName: String,
    byRole: String,
    note: String,
    ip: String,
  },
  { timestamps: { createdAt: 'at', updatedAt: false } }
);
module.exports = mongoose.model('ApprovalLog', logSchema);
