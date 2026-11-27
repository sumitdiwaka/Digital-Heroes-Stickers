const mongoose = require('mongoose');

// A "division" = one of the six print ranges. Stored in DB so new divisions need no code change.
const divisionSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    tagline: String,
    description: String,
    imageUrl: String,
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
module.exports = mongoose.model('Division', divisionSchema);
