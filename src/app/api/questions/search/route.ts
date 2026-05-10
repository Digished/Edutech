import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { loadAccessSummary } from '@/lib/access/gate';
import {
  serverError, paginated, badRequest, unauthorized,
} from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';

// GET /api/questions/search?q=&course_id=&school=&department=&page=&limit=
export async function GET(req: NextRequest) {
  try {
    const { profile, error: authErr } = await requireRole(['student', 'contributor', 'admin']);
    if (authErr || !profile) return unauthorized(authErr ?? 'Sign in to search');

    const access = await loadAccessSummary(profile);
    if (!access.hasFullAccess && access.unlocked.length === 0) {
      return paginated([], 0, 1, 0, { unlocked: [] });
    }

    const { searchParams } = req.nextUrl;
    const q = searchParams.get('q');
    const course_id = searchParams.get('course_id');
    const school = searchParams.get('school');
    const department = searchParams.get('department');
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const { from, to } = getPagination(page, limit);

    if (!q || q.trim().length < 3) return badRequest('Search query must be at least 3 characters');

    let allowedCourseIds: string[] | null = null;
    if (!access.hasFullAccess) {
      const adminClient = createAdminClient();
      const facultyIds = access.unlocked.map((u) => u.faculty_id);
      const { data: rows } = await adminClient
        .from('courses').select('id').in('faculty_id', facultyIds);
      allowedCourseIds = (rows ?? []).map((r) => r.id);
      if (allowedCourseIds.length === 0) {
        return paginated([], 0, 1, limit, { unlocked: access.unlocked });
      }
    }

    const supabase = await createClient();

    let query = supabase
      .from('questions')
      .select(
        `*, courses!inner(name, school, department, code)`,
        { count: 'exact' },
      )
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .textSearch('question_text', q, { type: 'websearch', config: 'english' });

    if (allowedCourseIds) query = query.in('course_id', allowedCourseIds);
    if (course_id) query = query.eq('course_id', course_id);
    if (school) query = query.eq('courses.school', school);
    if (department) query = query.eq('courses.department', department);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return serverError(error.message);
    const sanitized = (data ?? []).map((row) => {
      const { correct_answer: _omit, ...rest } = row as Record<string, unknown>;
      void _omit;
      return rest;
    });
    return paginated(sanitized, count ?? 0, page, limit, { unlocked: access.unlocked });
  } catch {
    return serverError();
  }
}
