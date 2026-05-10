import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/utils/auth';
import { gradeTheoryAnswer } from '@/lib/ocr/answers';
import { canRead, loadAccessSummary } from '@/lib/access/gate';
import { ok, badRequest, forbidden, unauthorized, notFound, serverError } from '@/lib/utils/response';
import { friendlyZodError } from '@/lib/utils/friendly-errors';

const schema = z.object({
  question_id: z.string().uuid(),
  answer: z.string().min(1),
});

// POST /api/questions/grade-theory — uses AI to score how close a student's
// theory answer is to a fully-correct one.
export async function POST(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

    const supabase = await createClient();
    const { data: question } = await supabase
      .from('questions')
      .select('id, question_text, question_type, correct_answer, status, is_deleted, courses(faculty_id)')
      .eq('id', parsed.data.question_id)
      .single();

    if (!question || question.is_deleted || question.status !== 'approved') {
      return notFound('Question not found');
    }
    if (question.question_type !== 'theory') {
      return badRequest('Theory grading is only available for theory questions');
    }

    const access = await loadAccessSummary(profile);
    const courseRow = (question.courses ?? null) as unknown as { faculty_id: string | null } | null;
    if (!canRead(access, courseRow?.faculty_id ?? null)) {
      return forbidden('Subscribe to this faculty to unlock the question.');
    }

    // gradeTheoryAnswer accepts a null reference and grades from the model's
    // own knowledge — we always call it.
    const grade = await gradeTheoryAnswer(
      question.question_text,
      parsed.data.answer,
      question.correct_answer,
    );
    return ok(grade);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Grading failed';
    return serverError(message);
  }
}
