import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/utils/auth';
import { created, badRequest, unauthorized, serverError, paginated } from '@/lib/utils/response';
import { friendlyZodError } from '@/lib/utils/friendly-errors';
import { getPagination } from '@/lib/utils/pagination';

const schema = z.object({
  faculty_id: z.string().uuid(),
  name: z.string().min(1),
});

export async function GET(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { searchParams } = req.nextUrl;
    const facultyId = searchParams.get('faculty_id');
    const universityId = searchParams.get('university_id');
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '100');
    const { from, to } = getPagination(page, limit);

    const supabase = await createClient();
    let query = supabase
      .from('departments')
      .select('*, faculties(id, name, university_id, universities(name))', { count: 'exact' });
    if (facultyId) {
      query = query.eq('faculty_id', facultyId);
    } else if (universityId) {
      const { data: facultyRows } = await supabase
        .from('faculties')
        .select('id')
        .eq('university_id', universityId);
      const ids = (facultyRows ?? []).map((f) => f.id);
      if (!ids.length) return paginated([], 0, page, limit);
      query = query.in('faculty_id', ids);
    }

    const { data, count, error: dbError } = await query.order('name').range(from, to);
    if (dbError) return serverError(dbError.message);
    return paginated(data ?? [], count ?? 0, page, limit);
  } catch {
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

    const supabase = await createClient();
    const { data, error: dbError } = await supabase
      .from('departments')
      .insert(parsed.data)
      .select()
      .single();

    if (dbError) {
      if (dbError.code === '23505') return badRequest('That department already exists for this faculty');
      return serverError(dbError.message);
    }
    return created(data);
  } catch {
    return serverError();
  }
}
