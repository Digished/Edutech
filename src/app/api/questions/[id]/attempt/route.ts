import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { ok, badRequest, unauthorized, notFound, serverError } from '@/lib/utils/response';

const schema = z.object({
  answer: z.string().min(1).max(10_000),
});

// GET — return the current user's attempt for this question (if any).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { id } = await params;
    const supabase = await createClient();
    const { data } = await supabase
      .from('question_attempts')
      .select('*')
      .eq('question_id', id)
      .eq('user_id', profile.id)
      .maybeSingle();
    return ok(data ?? null);
  } catch {
    return serverError();
  }
}

// POST — record / update the user's answer. MCQ answers are auto-graded.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const supabase = await createClient();
    const { data: question } = await supabase
      .from('questions')
      .select('id, question_type, correct_answer, is_deleted, status')
      .eq('id', id)
      .single();

    if (!question || question.is_deleted || question.status !== 'approved') {
      return notFound('Question not found');
    }

    let isCorrect: boolean | null = null;
    let normalizedAnswer = parsed.data.answer.trim();
    if (question.question_type === 'mcq') {
      // Take the first character (A-Z), uppercase.
      normalizedAnswer = normalizedAnswer.charAt(0).toUpperCase();
      if (question.correct_answer) {
        isCorrect = normalizedAnswer === question.correct_answer.trim().toUpperCase();
      }
    }

    const adminSupabase = createAdminClient();
    const { data, error: dbError } = await adminSupabase
      .from('question_attempts')
      .upsert(
        {
          question_id: id,
          user_id: profile.id,
          answer: normalizedAnswer,
          is_correct: isCorrect,
        },
        { onConflict: 'question_id,user_id' },
      )
      .select()
      .single();

    if (dbError) return serverError(dbError.message);
    return ok(data);
  } catch {
    return serverError();
  }
}
