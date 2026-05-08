import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/utils/auth';
import { created, badRequest, unauthorized, notFound, serverError } from '@/lib/utils/response';

const FLAG_REASONS = [
  'incorrect_answer',
  'duplicate',
  'offensive',
  'wrong_course',
  'typo',
  'other',
] as const;

const schema = z.object({
  reason: z.enum(FLAG_REASONS),
  details: z.string().max(2000).optional(),
});

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
      .select('id, is_deleted')
      .eq('id', id)
      .single();
    if (!question || question.is_deleted) return notFound('Question not found');

    const { data, error: dbError } = await supabase
      .from('question_flags')
      .upsert(
        {
          question_id: id,
          user_id: profile.id,
          reason: parsed.data.reason,
          details: parsed.data.details ?? null,
          status: 'open',
        },
        { onConflict: 'question_id,user_id,reason' },
      )
      .select('id, question_id, reason, details, status, created_at')
      .single();

    if (dbError) return serverError(dbError.message);
    return created(data);
  } catch {
    return serverError();
  }
}
