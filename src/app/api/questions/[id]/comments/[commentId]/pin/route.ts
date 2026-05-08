import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { ok, unauthorized, forbidden, notFound, serverError } from '@/lib/utils/response';

// POST — toggle pin on a comment. Admins, or the original question
// contributor (upload/extraction), can pin.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { id: questionId, commentId } = await params;
    const supabase = await createClient();

    if (profile.role !== 'admin') {
      const { data: contrib } = await supabase
        .from('question_contributions')
        .select('user_id')
        .eq('question_id', questionId)
        .eq('user_id', profile.id)
        .in('contribution_type', ['upload', 'extraction'])
        .maybeSingle();
      if (!contrib) return forbidden('Only the question contributor or an admin can pin answers');
    }

    const adminSupabase = createAdminClient();
    const { data: existing } = await adminSupabase
      .from('question_comments')
      .select('id, pinned, question_id')
      .eq('id', commentId)
      .eq('question_id', questionId)
      .maybeSingle();

    if (!existing) return notFound('Comment not found');

    const nextPinned = !existing.pinned;
    const { error: updateErr } = await adminSupabase
      .from('question_comments')
      .update({ pinned: nextPinned })
      .eq('id', commentId);

    if (updateErr) return serverError(updateErr.message);
    return ok({ pinned: nextPinned });
  } catch {
    return serverError();
  }
}
