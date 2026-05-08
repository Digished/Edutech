import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/utils/auth';
import { ok, unauthorized, notFound, forbidden, serverError } from '@/lib/utils/response';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { id } = await params;
    const supabase = await createClient();
    const { data, error: dbError } = await supabase
      .from('uploads')
      .select('*, courses(name, school, department)')
      .eq('id', id)
      .single();

    if (dbError || !data) return notFound('Upload not found');
    if (profile.role !== 'admin' && data.user_id !== profile.id) return forbidden();
    return ok(data);
  } catch {
    return serverError();
  }
}
