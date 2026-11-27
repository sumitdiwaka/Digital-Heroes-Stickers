const mongoose = require('mongoose');

// Every revision is its own immutable document: v1, v2, ... so "which file was approved" is never in doubt.
const proofSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    version: { type: Number, required: true },
    previewKey: { type: String, required: true },       // PNG preview in storage
    designHash: String,                                  // sha1 of the artwork it was made from
    origin: { type: String, enum: ['generated', 'admin_upload', 'carried_over'], default: 'generated' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'approved', 'changes_requested', 'superseded'], default: 'pending' },
    changeRequestNote: String,
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedAt: Date,
    note: String,
  },
  { timestamps: true }
);
proofSchema.index({ order: 1, version: 1 }, { unique: true });
module.exports = mongoose.model('Proof', proofSchema);
