/** ?page=1&limit=20 -> {page, limit, skip}; and a standard envelope for list responses. */
const parsePage = (q, max = 100) => {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(max, Math.max(1, parseInt(q.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
};
const pageMeta = ({ page, limit }, total) => ({ page, limit, total, pages: Math.ceil(total / limit) || 1 });
module.exports = { parsePage, pageMeta };
