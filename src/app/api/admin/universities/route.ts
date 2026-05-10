import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/utils/auth';
import { created, badRequest, unauthorized, serverError, paginated } from '@/lib/utils/response';
import { friendlyZodError } from '@/lib/utils/friendly-errors';
import { getPagination } from '@/lib/utils/pagination';

const schema = z.object({
  name: z.string().min(1),
  short_name: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '50');
    const search = searchParams.get('search');
    const { from, to } = getPagination(page, limit);

    const supabase = await createClient();
    let query = supabase.from('universities').select('*', { count: 'exact' });
    if (search) query = query.ilike('name', `%${search}%`);

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
      .from('universities')
      .insert(parsed.data)
      .select()
      .single();

    if (dbError) {
      if (dbError.code === '23505') return badRequest('A university with this name already exists');
      return serverError(dbError.message);
    }
    return created(data);
  } catch {
    return serverError();
  }
}
