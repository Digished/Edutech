import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { ok, unauthorized, serverError, paginated } from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';

// GET /api/admin/users?role=&school=&is_banned=&page=&limit=
export async function GET(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { searchParams } = req.nextUrl;
    const role = searchParams.get('role');
    const school = searchParams.get('school');
    const is_banned = searchParams.get('is_banned');
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const { from, to } = getPagination(page, limit);

    const supabase = createAdminClient();
    let query = supabase.from('users').select('*', { count: 'exact' });

    if (role) query = query.eq('role', role as 'student' | 'contributor' | 'admin');
    if (school) query = query.ilike('school', `%${school}%`);
    if (is_banned !== null && is_banned !== undefined)
      query = query.eq('is_banned', is_banned === 'true');

    const { data, count, error: dbError } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (dbError) return serverError(dbError.message);
    return paginated(data ?? [], count ?? 0, page, limit);
  } catch {
    return serverError();
  }
}
