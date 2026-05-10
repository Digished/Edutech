import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/utils/auth';
import {
  created, badRequest, unauthorized, serverError, paginated,
} from '@/lib/utils/response';
import { friendlyZodError } from '@/lib/utils/friendly-errors';
import { getPagination } from '@/lib/utils/pagination';
import type { Json } from '@/types/supabase';

const detailSchema = z.object({
  question_id: z.string().uuid(),
  question_type: z.enum(['mcq', 'theory']),
  given: z.string().default(''),
  expected: z.string().nullable().optional(),
  correct: z.boolean().nullable().optional(),
  score: z.number().min(0).max(1).nullable().optional(),
  feedback: z.string().nullable().optional(),
});

const schema = z.object({
  course_id: z.string().uuid().nullable().optional(),
  question_type: z.enum(['mcq', 'theory', 'all']).nullable().optional(),
  reveal_mode: z.enum(['after_each', 'at_end']).nullable().optional(),
  level: z.union([z.literal(100), z.literal(200), z.literal(300), z.literal(400), z.literal(500), z.literal(600)]).nullable().optional(),
  semester: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().optional(),
  total_questions: z.number().int().min(1),
  duration_ms: z.number().int().min(0).nullable().optional(),
  details: z.array(detailSchema).max(2000),
});

// GET /api/practice-sessions — list own sessions, newest first
export async function GET(req: NextRequest) {
  try {
    const { authUser, error } = await getAuthUser();
    if (error || !authUser) return unauthorized();

    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50);
    const { from, to } = getPagination(page, limit);

    const supabase = await createClient();
    const { data, count, error: dbError } = await supabase
      .from('practice_sessions')
      .select(
        'id, course_id, question_type, reveal_mode, total_questions, graded_count, correct_count, total_score, duration_ms, created_at',
        { count: 'exact' },
      )
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (dbError) return serverError(dbError.message);
    return paginated(data ?? [], count ?? 0, page, limit);
  } catch {
    return serverError();
  }
}

// POST /api/practice-sessions — persist a finished run
export async function POST(req: NextRequest) {
  try {
    const { authUser, error } = await getAuthUser();
    if (error || !authUser) return unauthorized();

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

    const { details, total_questions, duration_ms, course_id, question_type, reveal_mode, level, semester } = parsed.data;
    const graded = details.filter((d) => typeof d.score === 'number');
    const totalScore = graded.reduce((s, d) => s + (d.score ?? 0), 0);
    const correctCount = details.filter((d) => d.correct === true).length;

    const admin = createAdminClient();
    const { data, error: insertErr } = await admin
      .from('practice_sessions')
      .insert({
        user_id: authUser.id,
        course_id: course_id ?? null,
        question_type: question_type ?? null,
        reveal_mode: reveal_mode ?? null,
        level: level ?? null,
        semester: semester ?? null,
        total_questions,
        graded_count: graded.length,
        correct_count: correctCount,
        total_score: graded.length > 0 ? Number(totalScore.toFixed(3)) : null,
        duration_ms: duration_ms ?? null,
        details: details as unknown as Json,
      })
      .select('id, created_at')
      .single();

    if (insertErr) return serverError(insertErr.message);
    return created(data, 'Practice session saved');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not save session';
    return serverError(msg);
  }
}
