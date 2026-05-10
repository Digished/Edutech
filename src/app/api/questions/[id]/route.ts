import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole, getAuthUser } from '@/lib/utils/auth';
import { canRead, loadAccessSummary } from '@/lib/access/gate';
import {
  ok, badRequest, forbidden, unauthorized, notFound, serverError,
} from '@/lib/utils/response';
import { friendlyZodError } from '@/lib/utils/friendly-errors';

const updateSchema = z.object({
  question_text: z.string().min(5).optional(),
  options: z.record(z.string(), z.string()).nullable().optional(),
  correct_answer: z.string().nullable().optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  image_urls: z.array(z.string().url()).max(8).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { profile } = await getAuthUser();
    if (!profile) return unauthorized('Sign in to view this question');

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('questions')
      .select(`*, courses(name, school, department, faculty_id, code), question_analytics(views_count, last_viewed_at)`)
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (error || !data) return notFound('Question not found');

    const access = await loadAccessSummary(profile);
    const courseRow = (data as unknown as { courses: { faculty_id: string | null } | null }).courses;
    if (!canRead(access, courseRow?.faculty_id ?? null)) {
      return forbidden('Subscribe to this faculty to unlock the question.');
    }

    let group: { id: string; stem: string; stem_image_urls: unknown } | null = null;
    let group_siblings: { id: string; part_label: string | null; position: number | null }[] = [];
    const groupId = (data as unknown as { group_id: string | null }).group_id;
    if (groupId) {
      const [{ data: g }, { data: sibs }] = await Promise.all([
        supabase
          .from('question_groups')
          .select('id, stem, stem_image_urls')
          .eq('id', groupId)
          .single(),
        supabase
          .from('questions')
          .select('id, part_label, position')
          .eq('group_id', groupId)
          .eq('is_deleted', false)
          .order('position', { ascending: true }),
      ]);
      group = g ?? null;
      group_siblings = sibs ?? [];
    }

    await createAdminClient().rpc('increment_question_views', { p_question_id: id });
    return ok({ ...data, group, group_siblings });
  } catch {
    return serverError();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authUser, profile, error } = await getAuthUser();
    if (error || !authUser || !profile) return unauthorized();

    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

    const adminSupabase = createAdminClient();

    const { data: existing } = await adminSupabase
      .from('questions')
      .select('id, course_id')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (!existing) return notFound('Question not found');

    const { data, error: dbError } = await adminSupabase
      .from('questions')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single();

    if (dbError) return serverError(dbError.message);

    // Log edit contribution (upsert — contributor can only have one edit entry)
    await adminSupabase.from('question_contributions').upsert(
      {
        question_id: id,
        user_id: authUser.id,
        contribution_type: 'edit',
        contribution_weight: 0.5,
      },
      { onConflict: 'question_id,user_id,contribution_type' },
    );

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
    const adminSupabase = createAdminClient();
    await adminSupabase.from('questions').update({ is_deleted: true }).eq('id', id);
    return ok(null, 'Question deleted');
  } catch {
    return serverError();
  }
}
