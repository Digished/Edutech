import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import {
  created, badRequest, unauthorized, serverError, paginated,
} from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';
import { hashQuestionText } from '@/lib/utils/hash';
import { detectDuplicates, findDuplicateMatch } from '@/lib/dedup/similarity';

const schema = z.object({
  course_id: z.string().uuid(),
  question_text: z.string().min(5),
  options: z
    .record(z.string(), z.string())
    .nullable()
    .optional(),
  correct_answer: z.string().nullable().optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
});

// GET /api/questions?course_id=&year=&page=&limit= — auth required
export async function GET(req: NextRequest) {
  try {
    const { profile, error: authErr } = await requireRole(['student', 'contributor', 'admin']);
    if (authErr || !profile) return unauthorized(authErr ?? 'Sign in to browse questions');

    const { searchParams } = req.nextUrl;
    const course_id = searchParams.get('course_id');
    const year = searchParams.get('year');
    const question_type = searchParams.get('question_type');
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const { from, to } = getPagination(page, limit);

    const supabase = await createClient();
    let query = supabase
      .from('questions')
      .select(
        `*, courses(name, school, department, code), question_analytics(views_count, last_viewed_at)`,
        { count: 'exact' },
      )
      .eq('status', 'approved')
      .eq('is_deleted', false);

    if (course_id) query = query.eq('course_id', course_id);
    if (year) query = query.eq('year', parseInt(year));
    if (question_type === 'mcq' || question_type === 'theory') {
      query = query.eq('question_type', question_type);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return serverError(error.message);
    return paginated(data ?? [], count ?? 0, page, limit);
  } catch {
    return serverError();
  }
}

// POST /api/questions — contributor or admin
export async function POST(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const { course_id, question_text, options, correct_answer, year } = parsed.data;
    const content_hash = hashQuestionText(question_text);

    const adminSupabase = createAdminClient();

    // Reject near-duplicates (≥85% trigram similarity within the same course).
    const dup = await findDuplicateMatch(question_text, course_id);
    if (dup) {
      return badRequest(
        `This question looks like a near-duplicate of an existing one (${Math.round(dup.score * 100)}% similar). Please edit the existing question instead.`,
      );
    }

    // Create question (pending moderation)
    const { data: question, error: qError } = await adminSupabase
      .from('questions')
      .insert({
        course_id,
        question_text,
        options: options ?? null,
        correct_answer: correct_answer ?? null,
        year: year ?? null,
        source_type: 'manual',
        status: 'pending',
        content_hash,
      })
      .select()
      .single();

    if (qError) return serverError(qError.message);

    // Log contribution
    await adminSupabase.from('question_contributions').insert({
      question_id: question.id,
      user_id: profile.id,
      contribution_type: 'upload',
      contribution_weight: 1.0,
    });

    // Async duplicate detection (don't block response)
    detectDuplicates(question.id, question_text, course_id).catch(() => null);

    // Auto-promote to contributor role if student
    if (profile.role === 'student') {
      await adminSupabase
        .from('users')
        .update({ role: 'contributor' })
        .eq('id', profile.id);
    }

    return created(question, 'Question submitted for review');
  } catch {
    return serverError();
  }
}
