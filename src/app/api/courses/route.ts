import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/utils/auth';
import { ok, created, badRequest, unauthorized, serverError, paginated } from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';

const schema = z.object({
  school: z.string().min(1),
  department: z.string().min(1),
  name: z.string().min(1),
  code: z.string().optional(),
});

// GET /api/courses?school=&department=&page=&limit=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const school = searchParams.get('school');
    const department = searchParams.get('department');
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const { from, to } = getPagination(page, limit);

    const supabase = await createClient();
    let query = supabase.from('courses').select('*', { count: 'exact' });

    if (school) query = query.ilike('school', `%${school}%`);
    if (department) query = query.ilike('department', `%${department}%`);

    const { data, count, error } = await query
      .order('school', { ascending: true })
      .order('name', { ascending: true })
      .range(from, to);

    if (error) return serverError(error.message);
    return paginated(data ?? [], count ?? 0, page, limit);
  } catch {
    return serverError();
  }
}

// POST /api/courses — contributor or admin
export async function POST(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const supabase = await createClient();
    const { data, error: dbError } = await supabase
      .from('courses')
      .insert({ ...parsed.data, created_by: profile.id })
      .select()
      .single();

    if (dbError) {
      if (dbError.code === '23505') return badRequest('Course with this code already exists in this school/department');
      return serverError(dbError.message);
    }

    return created(data);
  } catch {
    return serverError();
  }
}
