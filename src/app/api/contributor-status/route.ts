import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/utils/auth';
import { ok, unauthorized, serverError } from '@/lib/utils/response';

export const CONTRIBUTOR_PROMOTION_THRESHOLD = 100;

// GET /api/contributor-status — one-shot: role, contribution count toward
// becoming a contributor, and active subscription summary.
export async function GET() {
  try {
    const { authUser, profile, error } = await getAuthUser();
    if (error || !authUser || !profile) return unauthorized();

    const admin = createAdminClient();

    const [{ data: count }, { data: subRows }] = await Promise.all([
      admin.rpc('contributor_question_count', { p_user_id: authUser.id }),
      admin.rpc('get_active_subscription', { p_user_id: authUser.id }),
    ]);

    const subscription =
      Array.isArray(subRows) && subRows.length > 0 ? subRows[0] : null;

    const numericCount = typeof count === 'number' ? count : 0;
    const isContributor = profile.role === 'contributor' || profile.role === 'admin';

    return ok({
      role: profile.role,
      is_contributor: isContributor,
      approved_contributions: numericCount,
      promotion_threshold: CONTRIBUTOR_PROMOTION_THRESHOLD,
      progress_to_contributor: isContributor
        ? 1
        : Math.min(numericCount / CONTRIBUTOR_PROMOTION_THRESHOLD, 1),
      subscription: subscription
        ? {
            id: subscription.id,
            plan: subscription.plan,
            status: subscription.status,
            starts_at: subscription.starts_at,
            ends_at: subscription.ends_at,
          }
        : null,
      has_active_subscription: !!subscription,
    });
  } catch {
    return serverError();
  }
}
