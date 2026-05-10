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
      .select('id, user_id, course_id, level, semester, needs_review, processing_stage')
      .eq('id', id)
      .single();
    if (!upload) return notFound('Upload not found');
    if (profile.role !== 'admin' && upload.user_id !== profile.id) return forbidden();
    if (upload.processing_stage === 'Published' || upload.needs_review === false) {
      return ok({ published: 0, skipped: 0, already_published: true }, 'This batch has already been published');
    }

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

    // Cache one question_groups row per group_key in this batch so that all
    // sub-parts of the same multi-part question share one parent.
    const groupIdByKey = new Map<string, string>();

    const alreadyConfirmed = drafts.filter((d) => d.confirmed);
    const eligible = drafts.filter((d) => {
      if (d.confirmed) return false;
      if (d.excluded || d.is_duplicate) return false;
      if (!d.question_text?.trim()) return false;
      return true;
    });
    published += alreadyConfirmed.length;
    skipped += drafts.length - alreadyConfirmed.length - eligible.length;

    // Stable order: group_key first (so parts cluster), then position.
    eligible.sort((a, b) => {
      const ka = a.group_key ?? '';
      const kb = b.group_key ?? '';
      if (ka !== kb) return ka.localeCompare(kb);
      return (a.part_position ?? a.position ?? 0) - (b.part_position ?? b.position ?? 0);
    });

    for (const d of eligible) {
      let groupId: string | null = null;
      if (d.group_key && d.stem?.trim()) {
        const cached = groupIdByKey.get(d.group_key);
        if (cached) {
          groupId = cached;
        } else {
          const { data: g, error: gErr } = await adminSupabase
            .from('question_groups')
            .insert({
              course_id: upload.course_id,
              stem: d.stem,
              stem_image_urls: d.stem_image_urls ?? [],
              year: d.year ?? null,
              level: upload.level ?? null,
              semester: upload.semester ?? null,
              source_type: 'extracted',
              status: 'pending',
            })
            .select('id')
            .single();
          if (gErr || !g) {
            skipped++;
            continue;
          }
          groupId = g.id;
          groupIdByKey.set(d.group_key, groupId);
        }
      }

      const { data: q, error: qErr } = await adminSupabase
        .from('questions')
        .insert({
          course_id: upload.course_id,
          group_id: groupId,
          part_label: d.part_label ?? null,
          position: d.part_position ?? null,
          question_text: d.question_text,
          question_type: d.question_type,
          options: d.question_type === 'mcq' ? d.options : null,
          correct_answer: d.correct_answer,
          year: d.year,
          level: upload.level ?? null,
          semester: upload.semester ?? null,
          source_type: 'extracted',
          status: 'pending',
          content_hash: d.content_hash,
          image_urls: d.image_urls ?? [],
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

    return ok({ published, skipped, question_ids: publishedIds }, `Submitted ${published} question${published === 1 ? '' : 's'} for admin review`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to publish';
    return serverError(message);
  }
}
