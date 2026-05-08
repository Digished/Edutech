import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/utils/auth';
import { ok, badRequest, unauthorized, notFound, serverError } from '@/lib/utils/response';

const updateSchema = z.object({
  school: z.string().min(1).optional(),
  department: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  code: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase.from('courses').select('*').eq('id', id).single();
    if (error || !data) return notFound('Course not found');
    return ok(data);
  } catch {
    return serverError();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const supabase = await createClient();
    const { data, error: dbError } = await supabase
      .from('courses')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single();

    if (dbError) return serverError(dbError.message);
    if (!data) return notFound();
    return ok(data);
  } catch {
    return serverError();
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { id } = await params;
    const supabase = await createClient();
    await supabase.from('courses').delete().eq('id', id);
    return ok(null, 'Course deleted');
  } catch {
    return serverError();
  }
}
