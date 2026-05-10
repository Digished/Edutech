import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/utils/auth';
import { ok, unauthorized, serverError, paginated } from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';

// GET /api/contributions — own contribution history
export async function GET(req: NextRequest) {
  try {
    const { authUser, error } = await getAuthUser();
    if (error || !authUser) return unauthorized();

    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const { from, to } = getPagination(page, limit);

    const supabase = await createClient();
    const { data, count, error: dbError } = await supabase
      .from('question_contributions')
      .select(
        `
        id, contribution_type, created_at,
        questions(id, question_text, course_id, status, is_deleted,
          courses(name, school, department)
        )
      `,
        { count: 'exact' },
      )
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (dbError) {
      console.error('[contributions] query error:', dbError);
      return serverError(`contributions: ${dbError.message}`);
    }
    return paginated(data ?? [], count ?? 0, page, limit);
  } catch (e) {
    console.error('[contributions] unexpected error:', e);
    return serverError(e instanceof Error ? e.message : 'unknown error');
  }
}
