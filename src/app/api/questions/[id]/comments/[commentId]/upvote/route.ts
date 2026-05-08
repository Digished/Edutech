import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/utils/auth';
import { ok, unauthorized, serverError } from '@/lib/utils/response';

// POST — toggle the current user's upvote for a comment.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { commentId } = await params;
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('comment_upvotes')
      .select('comment_id')
      .eq('comment_id', commentId)
      .eq('user_id', profile.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('comment_upvotes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', profile.id);
    } else {
      await supabase
        .from('comment_upvotes')
        .insert({ comment_id: commentId, user_id: profile.id });
    }

    const { count } = await supabase
      .from('comment_upvotes')
      .select('*', { count: 'exact', head: true })
      .eq('comment_id', commentId);

    return ok({ upvoted: !existing, upvote_count: count ?? 0 });
  } catch {
    return serverError();
  }
}
