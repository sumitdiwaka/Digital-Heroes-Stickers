const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema(
  {
    division: { type: mongoose.Schema.Types.ObjectId, ref: 'Division', required: true, index: true },
    title: { type: String, required: true },
    caption: String,
    imageUrl: { type: String, required: true },
    tags: [String],
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
module.exports = mongoose.model('Gallery', gallerySchema);
