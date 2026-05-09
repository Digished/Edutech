import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { loadAccessSummary } from '@/lib/access/gate';
import { ok, unauthorized, serverError } from '@/lib/utils/response';

// GET /api/practice/available-count?course_id=a,b,c&question_type=mcq|theory|all
// Returns the number of approved, non-deleted questions that match the given
// filters, restricted to courses in (school, department) combos the user has
// unlocked. Used by the practice setup page to live-cap the count input.
export async function GET(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const access = await loadAccessSummary(profile);

    const { searchParams } = req.nextUrl;
    const rawCourseIds = searchParams.get('course_ids') || searchParams.get('course_id') || '';
    const requestedCourseIds = rawCourseIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const questionType = searchParams.get('question_type');

    const adminClient = createAdminClient();

    // Resolve the set of course IDs the user is allowed to query against.
    let allowedCourseIds: string[];
    if (access.hasFullAccess) {
      const { data: rows } = await adminClient.from('courses').select('id');
      allowedCourseIds = (rows ?? []).map((r) => r.id);
    } else if (access.unlocked.length === 0) {
      return ok({ total: 0, allowed_courses: 0 });
    } else {
      const orPairs = access.unlocked.map(
        (u) => `and(school.eq."${u.school.replace(/"/g, '\\"')}",department.eq."${u.department.replace(/"/g, '\\"')}")`,
      );
      const { data: rows } = await adminClient.from('courses').select('id').or(orPairs.join(','));
      allowedCourseIds = (rows ?? []).map((r) => r.id);
    }

    const filtered = requestedCourseIds.length > 0
      ? allowedCourseIds.filter((id) => requestedCourseIds.includes(id))
      : allowedCourseIds;

    if (filtered.length === 0) return ok({ total: 0, allowed_courses: allowedCourseIds.length });

    let q = adminClient
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .in('course_id', filtered);
    if (questionType === 'mcq' || questionType === 'theory') {
      q = q.eq('question_type', questionType);
    }
    const { count } = await q;
    return ok({ total: count ?? 0, allowed_courses: allowedCourseIds.length });
  } catch {
    return serverError();
  }
}
