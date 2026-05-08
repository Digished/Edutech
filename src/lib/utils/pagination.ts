export function getPagination(page = 1, limit = 20) {
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;
  return { from, to, limit: safeLimit, page: safePage };
}
