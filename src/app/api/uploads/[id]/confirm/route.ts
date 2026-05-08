import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { detectDuplicates } from '@/lib/dedup/similarity';
import { ok, unauthorized, forbidden, notFound, serverError } from '@/lib/utils/response';

// POST /api/uploads/[id]/confirm — publish all non-excluded, non-duplicate drafts.
// Owner or admin.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { id } = await params;
    const supabase = await createClient();

    const { data: upload } = await supabase
      .from('uploads')
      .select('id, user_id, course_id')
      .eq('id', id)
      .single();
    if (!upload) return notFound('Upload not found');
    if (profile.role !== 'admin' && upload.user_id !== profile.id) return forbidden();

    const adminSupabase = createAdminClient();

    const { data: drafts } = await adminSupabase
      .from('upload_extractions')
      .select('*')
      .eq('upload_id', id);

    if (!drafts || drafts.length === 0) {
      return ok({ published: 0, skipped: 0 }, 'Nothing to publish');
    }

    let published = 0;
    let skipped = 0;
    const publishedIds: string[] = [];

    for (const d of drafts) {
      if (d.confirmed) {
        published++;
        continue;
      }
      if (d.excluded || d.is_duplicate) {
        skipped++;
        continue;
      }
      if (!d.question_text?.trim()) {
        skipped++;
        continue;
      }

      const { data: q, error: qErr } = await adminSupabase
        .from('questions')
        .insert({
          course_id: upload.course_id,
          question_text: d.question_text,
          question_type: d.question_type,
          options: d.question_type === 'mcq' ? d.options : null,
          correct_answer: d.correct_answer,
          year: d.year,
          source_type: 'extracted',
          status: 'approved',
          content_hash: d.content_hash,
        })
        .select('id, question_text, course_id')
        .single();

      if (qErr || !q) {
        skipped++;
        continue;
      }

      await adminSupabase.from('question_contributions').insert({
        question_id: q.id,
        user_id: upload.user_id,
        contribution_type: 'extraction',
        contribution_weight: 1.0,
      });

      // Mark this draft as confirmed (kept for audit; actual question lives in `questions`).
      await adminSupabase
        .from('upload_extractions')
        .update({ confirmed: true })
        .eq('id', d.id);

      detectDuplicates(q.id, q.question_text, q.course_id).catch(() => null);
      publishedIds.push(q.id);
      published++;
    }

    // Promote student → contributor on first publish.
    if (published > 0 && profile.role === 'student') {
      await adminSupabase.from('users').update({ role: 'contributor' }).eq('id', profile.id);
    }

    await adminSupabase
      .from('uploads')
      .update({
        needs_review: false,
        questions_extracted: published,
        processing_stage: published > 0 ? 'Published' : 'Reviewed',
      })
      .eq('id', id);

    return ok({ published, skipped, question_ids: publishedIds }, `Published ${published} question${published === 1 ? '' : 's'}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to publish';
    return serverError(message);
  }
}
