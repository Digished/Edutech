import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { ok, created, badRequest, unauthorized, serverError, paginated } from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';

const schema = z.object({
  total_revenue: z.number().positive(),
  contribution_pool_percentage: z.number().min(0).max(100).default(70),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

// GET /api/admin/revenue
export async function GET(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized();

    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const { from, to } = getPagination(page, limit);

    const supabase = createAdminClient();
    const { data, count, error: dbError } = await supabase
      .from('revenue_pool')
      .select('*', { count: 'exact' })
      .order('period_start', { ascending: false })
      .range(from, to);

    if (dbError) return serverError(dbError.message);
    return paginated(data ?? [], count ?? 0, page, limit);
  } catch {
    return serverError();
  }
}

// POST /api/admin/revenue — create pool period
export async function POST(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized();

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const supabase = createAdminClient();
    const { data, error: dbError } = await supabase
      .from('revenue_pool')
      .insert(parsed.data)
      .select()
      .single();

    if (dbError) {
      if (dbError.code === '23505') return badRequest('Revenue pool for this period already exists');
      return serverError(dbError.message);
    }

    return created(data);
  } catch {
    return serverError();
  }
}
