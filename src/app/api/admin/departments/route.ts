import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/utils/auth';
import { created, badRequest, unauthorized, serverError, paginated } from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';

const schema = z.object({
  university_id: z.string().uuid(),
  name: z.string().min(1),
});

export async function GET(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { searchParams } = req.nextUrl;
    const universityId = searchParams.get('university_id');
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '100');
    const { from, to } = getPagination(page, limit);

    const supabase = await createClient();
    let query = supabase
      .from('departments')
      .select('*, universities(name)', { count: 'exact' });
    if (universityId) query = query.eq('university_id', universityId);

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
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const supabase = await createClient();
    const { data, error: dbError } = await supabase
      .from('departments')
      .insert(parsed.data)
      .select()
      .single();

    if (dbError) {
      if (dbError.code === '23505') return badRequest('That department already exists for this university');
      return serverError(dbError.message);
    }
    return created(data);
  } catch {
    return serverError();
  }
}
