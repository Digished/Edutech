import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/utils/auth';
import { ok, unauthorized, notFound, serverError } from '@/lib/utils/response';

// GET /api/practice-sessions/[id] — full session including details + per-question
// metadata for the review view.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authUser, error } = await getAuthUser();
    if (error || !authUser) return unauthorized();
    const { id } = await params;

    const supabase = await createClient();
    const { data: session, error: sErr } = await supabase
      .from('practice_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', authUser.id)
      .single();
    if (sErr || !session) return notFound('Session not found');

    // Hydrate the per-question details with the latest question text + course.
    const details = Array.isArray(session.details) ? (session.details as Array<Record<string, unknown>>) : [];
    const ids = details
      .map((d) => (typeof d.question_id === 'string' ? d.question_id : null))
      .filter((v): v is string => !!v);

    let questions: Record<string, { question_text: string; question_type: string; course?: { name: string | null } | null }> = {};
    if (ids.length > 0) {
      const admin = createAdminClient();
      const { data: qs } = await admin
        .from('questions')
        .select('id, question_text, question_type, course_id')
        .in('id', ids);
      const courseIds = Array.from(
        new Set(((qs ?? []) as Array<{ course_id: string | null }>).map((q) => q.course_id).filter((v): v is string => !!v)),
      );
      let coursesById: Record<string, string | null> = {};
      if (courseIds.length > 0) {
        const { data: cs } = await admin
          .from('courses')
          .select('id, name')
          .in('id', courseIds);
        coursesById = Object.fromEntries(((cs ?? []) as Array<{ id: string; name: string | null }>).map((c) => [c.id, c.name ?? null]));
      }
      questions = Object.fromEntries(
        ((qs ?? []) as Array<{ id: string; question_text: string; question_type: string; course_id: string | null }>).map((q) => [
          q.id,
          {
            question_text: q.question_text,
            question_type: q.question_type,
            course: q.course_id ? { name: coursesById[q.course_id] ?? null } : null,
          },
        ]),
      );
    }

    return ok({ ...session, questions });
  } catch {
    return serverError();
  }
}

// DELETE /api/practice-sessions/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authUser, error } = await getAuthUser();
    if (error || !authUser) return unauthorized();
    const { id } = await params;
    const admin = createAdminClient();
    const { error: dErr } = await admin
      .from('practice_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', authUser.id);
    if (dErr) return serverError(dErr.message);
    return ok(null, 'Removed');
  } catch {
    return serverError();
  }
}
