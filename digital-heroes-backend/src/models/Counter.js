const mongoose = require('mongoose');

// Atomic counters (order numbers, invoice numbers) - safe under concurrent requests.
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = mongoose.model('Counter', counterSchema);

Counter.next = async (name) => {
  const doc = await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return doc.seq;
};
module.exports = Counter;
