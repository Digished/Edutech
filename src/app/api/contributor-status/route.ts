import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/utils/auth';
import { ok, unauthorized, serverError } from '@/lib/utils/response';

export const CONTRIBUTOR_PROMOTION_THRESHOLD = 100;

// GET /api/contributor-status — one-shot status object the dashboard,
// subscription page and gates rely on:
//  - role + admin/contributor flags
//  - approved_contributions count and progress to contributor
//  - currently-unlocked (school, department) combos
export async function GET() {
  try {
    const { authUser, profile, error } = await getAuthUser();
    if (error || !authUser || !profile) return unauthorized();

    const admin = createAdminClient();

    const [{ data: count }, { data: unlocked }] = await Promise.all([
      admin.rpc('contributor_question_count', { p_user_id: authUser.id }),
      admin.rpc('list_unlocked_departments', { p_user_id: authUser.id }),
    ]);

    const numericCount = typeof count === 'number' ? count : 0;
    const isAdmin = profile.role === 'admin';
    const isContributor = profile.role === 'contributor' || isAdmin;
    const list = Array.isArray(unlocked) ? unlocked : [];

    return ok({
      role: profile.role,
      is_admin: isAdmin,
      is_contributor: isContributor,
      // Whether the user can read the question bank without a subscription. Only
      // admins are exempt — contributors must subscribe (with their 60% off).
      has_full_access: isAdmin,
      approved_contributions: numericCount,
      promotion_threshold: CONTRIBUTOR_PROMOTION_THRESHOLD,
      progress_to_contributor: isContributor
        ? 1
        : Math.min(numericCount / CONTRIBUTOR_PROMOTION_THRESHOLD, 1),
      unlocked_departments: list,
    });
  } catch {
    return serverError();
  }
}
