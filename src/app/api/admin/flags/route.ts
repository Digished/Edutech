import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { unauthorized, serverError, paginated } from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';

// GET /api/admin/flags?status=open&question_id=&page=&limit=
export async function GET(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized();

    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status');
    const questionId = searchParams.get('question_id');
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '50');
    const { from, to } = getPagination(page, limit);

    const supabase = createAdminClient();
    let query = supabase
      .from('question_flags')
      .select(
        `id, question_id, reason, details, status, created_at,
         users(full_name, email),
         questions(question_text, status, is_deleted, courses(name, school))`,
        { count: 'exact' },
      );

    if (status) query = query.eq('status', status);
    if (questionId) query = query.eq('question_id', questionId);

    const { data, count, error: dbError } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (dbError) return serverError(dbError.message);
    return paginated(data ?? [], count ?? 0, page, limit);
  } catch {
    return serverError();
  }
}
