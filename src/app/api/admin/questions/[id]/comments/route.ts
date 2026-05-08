import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { ok, unauthorized, serverError } from '@/lib/utils/response';

// GET /api/admin/questions/[id]/comments — full unredacted comment list for admins.
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
      .from('question_comments')
      .select('id, body, is_anonymous, is_hidden, created_at, users(full_name, email)')
      .eq('question_id', id)
      .order('created_at', { ascending: true });

    if (dbError) return serverError(dbError.message);
    return ok(data ?? []);
  } catch {
    return serverError();
  }
}
