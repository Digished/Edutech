import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/utils/auth';
import { ok, unauthorized, forbidden, notFound, serverError } from '@/lib/utils/response';

// DELETE — author can delete own comment; admin can delete any.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { id, commentId } = await params;
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('question_comments')
      .select('id, user_id')
      .eq('id', commentId)
      .eq('question_id', id)
      .single();

    if (!existing) return notFound('Comment not found');
    if (profile.role !== 'admin' && existing.user_id !== profile.id) return forbidden();

    const { error: dbError } = await supabase
      .from('question_comments')
      .delete()
      .eq('id', commentId);

    if (dbError) return serverError(dbError.message);
    return ok(null, 'Comment deleted');
  } catch {
    return serverError();
  }
}
