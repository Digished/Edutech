import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { ok, unauthorized, serverError } from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';

// GET /api/admin/subscriptions
//   ?status=&plan=&search=&page=&limit=
// Returns a paginated list of subscriptions joined to users, plus aggregate
// revenue totals (lifetime + this calendar month, counted from successful
// payments only — i.e. status='active' or 'expired').
export async function GET(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status');
    const plan = searchParams.get('plan');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const { from, to } = getPagination(page, limit);

    const supabase = createAdminClient();

    let query = supabase
      .from('subscriptions')
      .select('*, users(id, full_name, email, school, role)', { count: 'exact' });

    if (status) query = query.eq('status', status as 'pending' | 'active' | 'expired' | 'cancelled');
    if (plan) query = query.eq('plan', plan as 'monthly' | 'quarterly' | 'yearly');

    const { data, count, error: dbError } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (dbError) return serverError(dbError.message);

    // Client-side search filter on user fields — Supabase can't filter on a
    // joined column trivially. We only filter the current page so very large
    // searches should use a more targeted filter. Acceptable for admin lists.
    let rows = data ?? [];
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((r) => {
        const u = (r as { users?: { full_name?: string; email?: string; school?: string } }).users;
        return (
          u?.full_name?.toLowerCase().includes(s) ||
          u?.email?.toLowerCase().includes(s) ||
          u?.school?.toLowerCase().includes(s)
        );
      });
    }

    // Revenue: lifetime + month-to-date, only counting subs that were paid
    // for (active or expired — pending/cancelled never collected money).
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [{ data: lifetime }, { data: thisMonth }, statusBreakdown] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('amount, currency')
        .in('status', ['active', 'expired']),
      supabase
        .from('subscriptions')
        .select('amount, currency')
        .in('status', ['active', 'expired'])
        .gte('created_at', monthStart.toISOString()),
      supabase
        .from('subscriptions')
        .select('status, amount'),
    ]);

    const sumAmount = (xs: { amount: number | string }[] | null) =>
      (xs ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);

    const currency = lifetime?.[0]?.currency ?? 'NGN';
    const totals = {
      lifetime_revenue: sumAmount(lifetime),
      this_month_revenue: sumAmount(thisMonth),
      currency,
      active_count: 0,
      pending_count: 0,
      expired_count: 0,
      cancelled_count: 0,
    };
    for (const r of statusBreakdown.data ?? []) {
      if (r.status === 'active') totals.active_count += 1;
      else if (r.status === 'pending') totals.pending_count += 1;
      else if (r.status === 'expired') totals.expired_count += 1;
      else if (r.status === 'cancelled') totals.cancelled_count += 1;
    }

    return ok({
      data: rows,
      total: count ?? 0,
      page,
      limit,
      totals,
    });
  } catch {
    return serverError();
  }
}
