import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { ok, badRequest, unauthorized, notFound, serverError } from '@/lib/utils/response';

// GET — returns { tagged: boolean, count: number, can_tag: boolean, reason?: string }
// for the current user. `can_tag` is false for the question's own contributor or
// users without an active subscription on the question's department.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Sign in to tag questions');

    const { id } = await params;
    const admin = createAdminClient();

    const { data: question } = await admin
      .from('questions')
      .select('id')
      .eq('id', id)
      .single();
    if (!question) return notFound('Question not found');

    const [tags, mine, eligible] = await Promise.all([
      admin.from('high_yield_tags').select('id, user_id', { count: 'exact' }).eq('question_id', id),
      admin
        .from('high_yield_tags')
        .select('id')
        .eq('question_id', id)
        .eq('user_id', profile.id)
        .maybeSingle(),
      admin.rpc('can_high_yield_tag', { p_user_id: profile.id, p_question_id: id }),
    ]);

    const count = tags.count ?? 0;
    const tagged = !!mine.data;
    const isAdmin = profile.role === 'admin';
    const can_tag = !!eligible.data && !tagged;
    const can_untag = tagged;

    let reason: string | undefined;
    if (!tagged && !can_tag) {
      // Surface the exact reason — the UI uses this in the tooltip.
      const { data: contrib } = await admin
        .from('question_contributions')
        .select('id')
        .eq('question_id', id)
        .eq('user_id', profile.id)
        .limit(1);
      if ((contrib ?? []).length) {
        reason = 'You contributed to this question, so you can\'t tag it as high yield.';
      } else {
        reason = 'You need an active subscription for this department to tag questions.';
      }
    }

    return ok({
      count,
      tagged,
      can_tag: can_tag || isAdmin,
      can_untag,
      reason,
    });
  } catch {
    return serverError();
  }
}

// POST — toggle the current user's tag on this question.
// Returns the new state. Live-recomputes contributor weight on the next
// distribution because rewards.ts reads tag count at calculation time.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Sign in to tag questions');

    const { id } = await params;
    const admin = createAdminClient();

    const { data: question } = await admin
      .from('questions')
      .select('id')
      .eq('id', id)
      .single();
    if (!question) return notFound('Question not found');

    const { data: existing } = await admin
      .from('high_yield_tags')
      .select('id')
      .eq('question_id', id)
      .eq('user_id', profile.id)
      .maybeSingle();

    if (existing) {
      // Toggle off — anyone who owns the tag can remove it.
      const { error: delError } = await admin
        .from('high_yield_tags')
        .delete()
        .eq('id', existing.id);
      if (delError) return serverError(delError.message);
    } else {
      // Eligibility check: subscribed + not the question's contributor.
      // Admins can always tag (useful for moderation/testing).
      if (profile.role !== 'admin') {
        const { data: eligible } = await admin.rpc('can_high_yield_tag', {
          p_user_id: profile.id,
          p_question_id: id,
        });
        if (!eligible) {
          const { data: contrib } = await admin
            .from('question_contributions')
            .select('id')
            .eq('question_id', id)
            .eq('user_id', profile.id)
            .limit(1);
          if ((contrib ?? []).length) {
            return badRequest('Contributors cannot tag their own questions as high yield');
          }
          return badRequest('An active subscription for this department is required to tag');
        }
      }

      const { error: insError } = await admin
        .from('high_yield_tags')
        .insert({ question_id: id, user_id: profile.id });
      if (insError) {
        // The trigger on the table also blocks self-tagging — surface a clean error.
        if (insError.message?.toLowerCase().includes('contributors cannot')) {
          return badRequest('Contributors cannot tag their own questions as high yield');
        }
        return serverError(insError.message);
      }
    }

    const { count } = await admin
      .from('high_yield_tags')
      .select('id', { count: 'exact', head: true })
      .eq('question_id', id);

    return ok({
      tagged: !existing,
      count: count ?? 0,
    });
  } catch {
    return serverError();
  }
}
