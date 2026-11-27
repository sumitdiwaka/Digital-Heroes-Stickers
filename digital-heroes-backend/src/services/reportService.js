const { Order } = require('../models');

/** Dashboard analytics: totals for orders, revenue and product-family throughput. */
async function summary({ from, to } = {}) {
  const match = {};
  if (from || to) { match.createdAt = {}; if (from) match.createdAt.$gte = new Date(from); if (to) match.createdAt.$lte = new Date(to); }
  const paid = { ...match, 'payment.status': 'paid' };

  const [totals, byStatus, byDivision, daily, topCustomers] = await Promise.all([
    Order.aggregate([{ $match: paid }, { $group: { _id: null, orders: { $sum: 1 }, revenueMinor: { $sum: '$pricing.totalMinor' }, netMinor: { $sum: '$pricing.subtotalMinor' }, taxMinor: { $sum: '$pricing.taxMinor' }, units: { $sum: '$quantity' } } }]),
    Order.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate([{ $match: paid }, { $group: { _id: '$divisionSlug', orders: { $sum: 1 }, units: { $sum: '$quantity' }, revenueMinor: { $sum: '$pricing.totalMinor' }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } }, { $sort: { revenueMinor: -1 } }]),
    Order.aggregate([{ $match: paid }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$payment.paidAt' } }, orders: { $sum: 1 }, revenueMinor: { $sum: '$pricing.totalMinor' } } }, { $sort: { _id: 1 } }, { $limit: 90 }]),
    Order.aggregate([{ $match: paid }, { $group: { _id: '$user', orders: { $sum: 1 }, revenueMinor: { $sum: '$pricing.totalMinor' } } }, { $sort: { revenueMinor: -1 } }, { $limit: 5 }, { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } }, { $project: { orders: 1, revenueMinor: 1, name: { $arrayElemAt: ['$u.name', 0] }, email: { $arrayElemAt: ['$u.email', 0] } } }]),
  ]);

  const t = totals[0] || { orders: 0, revenueMinor: 0, netMinor: 0, taxMinor: 0, units: 0 };
  const statusCounts = Object.fromEntries(Order.STATUSES.map((s) => [s, 0]));
  byStatus.forEach((s) => { statusCounts[s._id] = s.count; });
  return {
    totals: { paidOrders: t.orders, revenueMinor: t.revenueMinor, netRevenueMinor: t.netMinor, taxMinor: t.taxMinor, unitsPrinted: t.units, averageOrderMinor: t.orders ? Math.round(t.revenueMinor / t.orders) : 0 },
    byStatus: statusCounts,
    productFamilyThroughput: byDivision.map((d) => ({ division: d._id, orders: d.orders, units: d.units, completed: d.completed, revenueMinor: d.revenueMinor })),
    daily: daily.map((d) => ({ date: d._id, orders: d.orders, revenueMinor: d.revenueMinor })),
    topCustomers,
  };
}
module.exports = { summary };
