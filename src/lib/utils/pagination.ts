// `limit` is clamped to a generous upper bound so practice exams (which can
// pull a whole department's worth of questions) aren't artificially capped.
const MAX_PAGE_SIZE = 2000;

export function getPagination(page = 1, limit = 20) {
  const safeLimit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;
  return { from, to, limit: safeLimit, page: safePage };
}
