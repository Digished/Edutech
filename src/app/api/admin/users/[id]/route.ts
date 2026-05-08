import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { ok, badRequest, unauthorized, notFound, serverError } from '@/lib/utils/response';

const schema = z.object({
  role: z.enum(['student', 'contributor', 'admin']).optional(),
  is_banned: z.boolean().optional(),
  ban_reason: z.string().optional(),
});

// PATCH /api/admin/users/[id] — update role, ban/unban
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const supabase = createAdminClient();
    const { data, error: dbError } = await supabase
      .from('users')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single();

    if (dbError) return serverError(dbError.message);
    if (!data) return notFound('User not found');

    return ok(data);
  } catch {
    return serverError();
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized();

    const { id } = await params;
    const supabase = createAdminClient();
    const { data, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (dbError || !data) return notFound('User not found');
    return ok(data);
  } catch {
    return serverError();
  }
}
