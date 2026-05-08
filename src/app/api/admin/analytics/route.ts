import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { ok, unauthorized, serverError } from '@/lib/utils/response';

// GET /api/admin/analytics — platform-wide metrics
export async function GET() {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized();

    const supabase = createAdminClient();

    const [
      { count: totalUsers },
      { count: totalContributors },
      { count: totalQuestions },
      { count: pendingQuestions },
      { count: totalUploads },
      { count: totalWithdrawals },
      { data: topContributors },
      { data: mostViewedCourses },
      { data: revenueStats },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'contributor'),
      supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .eq('is_deleted', false),
      supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('is_deleted', false),
      supabase.from('uploads').select('*', { count: 'exact', head: true }),
      supabase.from('withdrawals').select('*', { count: 'exact', head: true }),
      // Top 10 contributors by question count
      supabase
        .from('question_contributions')
        .select('user_id, users(full_name, email, school)')
        .order('created_at', { ascending: false })
        .limit(200),
      // Most viewed courses (via question analytics)
      supabase
        .from('questions')
        .select('course_id, courses(name, school, department), question_analytics(views_count)')
        .eq('status', 'approved')
        .eq('is_deleted', false)
        .limit(500),
      // Revenue summary
      supabase
        .from('revenue_pool')
        .select('total_revenue, payout_pool_amount, distributed')
        .order('period_start', { ascending: false })
        .limit(12),
    ]);

    // Aggregate contributor counts
    const contribCounts = new Map<string, { user: unknown; count: number }>();
    for (const c of topContributors ?? []) {
      const existing = contribCounts.get(c.user_id) ?? { user: c.users, count: 0 };
      contribCounts.set(c.user_id, { user: c.users, count: existing.count + 1 });
    }
    const topContributorsList = [...contribCounts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([user_id, v]) => ({ user_id, ...v }));

    // Aggregate course views
    const courseViews = new Map<string, { course: unknown; views: number }>();
    for (const q of mostViewedCourses ?? []) {
      const views = (q.question_analytics as unknown as { views_count: number }[])?.[0]?.views_count ?? 0;
      const existing = courseViews.get(q.course_id) ?? { course: q.courses, views: 0 };
      courseViews.set(q.course_id, { course: q.courses, views: existing.views + views });
    }
    const topCoursesList = [...courseViews.entries()]
      .sort((a, b) => b[1].views - a[1].views)
      .slice(0, 10)
      .map(([course_id, v]) => ({ course_id, ...v }));

    // Revenue totals
    const totalRevenue = (revenueStats ?? []).reduce(
      (s, r) => s + (r.total_revenue as number),
      0,
    );
    const totalDistributed = (revenueStats ?? [])
      .filter((r) => r.distributed)
      .reduce((s, r) => s + (r.payout_pool_amount as number), 0);

    return ok({
      users: {
        total: totalUsers ?? 0,
        contributors: totalContributors ?? 0,
      },
      questions: {
        total: totalQuestions ?? 0,
        pending: pendingQuestions ?? 0,
      },
      uploads: { total: totalUploads ?? 0 },
      withdrawals: { total: totalWithdrawals ?? 0 },
      revenue: {
        total_collected: totalRevenue,
        total_distributed: totalDistributed,
        periods: revenueStats ?? [],
      },
      top_contributors: topContributorsList,
      most_viewed_courses: topCoursesList,
    });
  } catch {
    return serverError();
  }
}
