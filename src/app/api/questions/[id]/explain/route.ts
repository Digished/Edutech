import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { generateExplanation } from '@/lib/ocr/answers';
import { ok, unauthorized, forbidden, notFound, serverError } from '@/lib/utils/response';
import type { QuestionOptions } from '@/types/database';

// GET /api/questions/[id]/explain — return the cached explanation, if any.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { id } = await params;
    const admin = createAdminClient();

    const { data: question } = await admin
      .from('questions')
      .select('id, status, is_deleted, explanation, explanation_generated_at')
      .eq('id', id)
      .single();
    if (!question || question.is_deleted || question.status !== 'approved') {
      return notFound('Question not found');
    }

    return ok({
      explanation: question.explanation,
      generated_at: question.explanation_generated_at,
    });
  } catch {
    return serverError();
  }
}

// POST /api/questions/[id]/explain — generate (or return the cached) explanation.
// The first user to ask pays the generation cost; everyone else gets the cached
// version instantly.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { id } = await params;
    const admin = createAdminClient();

    if (profile.role === 'student') {
      const { data: hasSub } = await admin.rpc('has_active_subscription', {
        p_user_id: profile.id,
      });
      if (!hasSub) return forbidden('Subscribe to unlock explanations');
    }

    const { data: question } = await admin
      .from('questions')
      .select('id, status, is_deleted, question_text, question_type, options, correct_answer, explanation, explanation_generated_at')
      .eq('id', id)
      .single();
    if (!question || question.is_deleted || question.status !== 'approved') {
      return notFound('Question not found');
    }

    // Cache hit — return immediately.
    if (question.explanation && question.explanation.trim().length > 0) {
      return ok({
        explanation: question.explanation,
        generated_at: question.explanation_generated_at,
        cached: true,
      });
    }

    let result;
    try {
      result = await generateExplanation(
        question.question_text,
        question.question_type,
        question.options as QuestionOptions | null,
        question.correct_answer,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not generate explanation';
      return serverError(msg);
    }

    if (!result.explanation || !result.explanation.trim()) {
      return serverError('Empty explanation returned');
    }

    const generated_at = new Date().toISOString();

    // Race condition: another caller may have written first. The unique row id
    // makes this safe — last-writer wins on the same content.
    await admin
      .from('questions')
      .update({
        explanation: result.explanation,
        explanation_generated_at: generated_at,
      })
      .eq('id', id);

    return ok({
      explanation: result.explanation,
      generated_at,
      cached: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Explanation failed';
    return serverError(msg);
  }
}
