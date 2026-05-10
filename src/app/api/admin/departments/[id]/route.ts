import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/utils/auth';
import { ok, badRequest, unauthorized, notFound, serverError } from '@/lib/utils/response';
import { friendlyZodError } from '@/lib/utils/friendly-errors';

const schema = z.object({
  name: z.string().min(1).optional(),
  faculty_id: z.string().uuid().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

    const supabase = await createClient();
    const { data, error: dbError } = await supabase
      .from('departments')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single();

    if (dbError) {
      if (dbError.code === '23505') return badRequest('That department already exists for this faculty');
      return serverError(dbError.message);
    }
    if (!data) return notFound();
    return ok(data);
  } catch {
    return serverError();
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { id } = await params;
    const supabase = await createClient();
    const { error: dbError } = await supabase.from('departments').delete().eq('id', id);
    if (dbError) return serverError(dbError.message);
    return ok(null, 'Department deleted');
  } catch {
    return serverError();
  }
}
