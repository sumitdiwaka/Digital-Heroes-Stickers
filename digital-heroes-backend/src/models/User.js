const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer', index: true },
    phone: { type: String, trim: true },
    company: { type: String, trim: true },
    gstin: { type: String, trim: true }, // tax id printed on invoices
    address: {
      line1: String, line2: String, city: String, state: String, postalCode: String,
      country: { type: String, default: 'IN' },
    },
    isActive: { type: Boolean, default: true },
    // Scalability hook: corporate / multi-account ordering later (many users -> one organisation).
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
    passwordReset: { tokenHash: { type: String, select: false }, expiresAt: { type: Date, select: false } },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 11);
};
userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};
userSchema.methods.toSafeJSON = function () {
  const o = this.toObject();
  delete o.passwordHash; delete o.passwordReset; delete o.__v;
  return o;
};

module.exports = mongoose.model('User', userSchema);
