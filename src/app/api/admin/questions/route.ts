import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { unauthorized, serverError, paginated } from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';

// GET /api/admin/questions?status=pending&course_id=&page=&limit=
export async function GET(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized();

    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status') ?? 'pending';
    const course_id = searchParams.get('course_id');
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const { from, to } = getPagination(page, limit);

    const supabase = createAdminClient();
    let query = supabase
      .from('questions')
      .select(
        `*, courses(name, school, department), question_contributions(user_id, contribution_type, contribution_weight, users(full_name, email))`,
        { count: 'exact' },
      )
      .eq('status', status as 'pending' | 'approved' | 'rejected')
      .eq('is_deleted', false);

    if (course_id) query = query.eq('course_id', course_id);

    const { data, count, error: dbError } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (dbError) return serverError(dbError.message);
    return paginated(data ?? [], count ?? 0, page, limit);
  } catch {
    return serverError();
  }
}
