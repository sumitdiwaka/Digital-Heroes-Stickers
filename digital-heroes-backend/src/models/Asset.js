const mongoose = require('mongoose');

// Uploaded logo/image used inside the editor (separate from "finished artwork" uploads).
const assetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fileKey: { type: String, required: true },
    originalName: String,
    mime: String,
    ext: String,
    size: Number,
    widthPx: Number,
    heightPx: Number,
  },
  { timestamps: true }
);
module.exports = mongoose.model('Asset', assetSchema);
