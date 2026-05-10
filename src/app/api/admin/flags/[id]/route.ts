import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { ok, badRequest, unauthorized, notFound, serverError } from '@/lib/utils/response';
import { friendlyZodError } from '@/lib/utils/friendly-errors';

const schema = z.object({ status: z.enum(['open', 'reviewed', 'dismissed']) });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized();

    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

    const supabase = createAdminClient();
    const { data, error: dbError } = await supabase
      .from('question_flags')
      .update({
        status: parsed.data.status,
        reviewed_at: parsed.data.status === 'open' ? null : new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (dbError || !data) return notFound('Flag not found');
    return ok(data);
  } catch {
    return serverError();
  }
}
