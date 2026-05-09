import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { loadAccessSummary } from '@/lib/access/gate';
import {
  created, badRequest, unauthorized, serverError, paginated,
} from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';
import { hashQuestionText } from '@/lib/utils/hash';
import { detectDuplicates, findDuplicateMatch } from '@/lib/dedup/similarity';

const schema = z.object({
  course_id: z.string().uuid(),
  question_text: z.string().min(5),
  question_type: z.enum(['mcq', 'theory']).default('mcq'),
  options: z
    .record(z.string(), z.string())
    .nullable()
    .optional(),
  correct_answer: z.string().nullable().optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  image_urls: z.array(z.string().url()).max(8).optional(),
});

const CONTRIBUTOR_PROMOTION_THRESHOLD = 100;

// GET /api/questions?course_id=&year=&page=&limit= — auth required. Results are
// limited to questions in (school, department) combos the user has unlocked
// (admins see everything).
export async function GET(req: NextRequest) {
  try {
    const { profile, error: authErr } = await requireRole(['student', 'contributor', 'admin']);
    if (authErr || !profile) return unauthorized(authErr ?? 'Sign in to browse questions');

    const access = await loadAccessSummary(profile);
    if (!access.hasFullAccess && access.unlocked.length === 0) {
      return paginated([], 0, 1, 0, { unlocked: [] });
    }

    const { searchParams } = req.nextUrl;
    const course_id = searchParams.get('course_id');
    const school = searchParams.get('school');
    const department = searchParams.get('department');
    const year = searchParams.get('year');
    const question_type = searchParams.get('question_type');
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const { from, to } = getPagination(page, limit);

    const adminClient = createAdminClient();

    // Resolve the course IDs the user is allowed to see, then filter questions
    // by course_id. Cleaner than trying to do multi-column IN over a join.
    let allowedCourseIds: string[] | null = null;
    if (!access.hasFullAccess) {
      const orPairs = access.unlocked.map(
        (u) => `and(school.eq."${escapeFilter(u.school)}",department.eq."${escapeFilter(u.department)}")`,
      );
      const { data: rows, error: courseErr } = await adminClient
        .from('courses')
        .select('id')
        .or(orPairs.join(','));
      if (courseErr) return serverError(courseErr.message);
      allowedCourseIds = (rows ?? []).map((r) => r.id);
      if (allowedCourseIds.length === 0) {
        return paginated([], 0, 1, limit, { unlocked: access.unlocked });
      }
    }

    const supabase = await createClient();
    let query = supabase
      .from('questions')
      .select(
        `*, courses(name, school, department, code), question_analytics(views_count, last_viewed_at)`,
        { count: 'exact' },
      )
      .eq('status', 'approved')
      .eq('is_deleted', false);

    if (allowedCourseIds) query = query.in('course_id', allowedCourseIds);
    if (course_id) query = query.eq('course_id', course_id);
    if (year) query = query.eq('year', parseInt(year));
    if (question_type === 'mcq' || question_type === 'theory') {
      query = query.eq('question_type', question_type);
    }
    // school/department text filters apply to the join table.
    if (school || department) {
      const join = supabase
        .from('courses')
        .select('id');
      const filtered = school ? join.eq('school', school) : join;
      const final = department ? filtered.eq('department', department) : filtered;
      const { data: filteredCourses } = await final;
      const filteredIds = (filteredCourses ?? []).map((c) => c.id);
      query = query.in('course_id', filteredIds.length > 0 ? filteredIds : ['00000000-0000-0000-0000-000000000000']);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return serverError(error.message);
    const sanitized = (data ?? []).map((row) => {
      const { correct_answer: _omit, ...rest } = row as Record<string, unknown>;
      void _omit;
      return rest;
    });
    return paginated(sanitized, count ?? 0, page, limit, { unlocked: access.unlocked });
  } catch {
    return serverError();
  }
}

function escapeFilter(value: string): string {
  return value.replace(/"/g, '\\"');
}

// POST /api/questions — students may submit (for review); they get the contributor
// role once they have 100 approved upload/extraction contributions.
export async function POST(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const { course_id, question_text, question_type, options, correct_answer, year, image_urls } = parsed.data;
    if (question_type === 'mcq' && (!options || Object.keys(options).length < 2)) {
      return badRequest('Add at least two options for an MCQ');
    }

    const content_hash = hashQuestionText(question_text);

    const adminSupabase = createAdminClient();

    // Reject near-duplicates (≥85% trigram similarity within the same course).
    const dup = await findDuplicateMatch(question_text, course_id);
    if (dup) {
      return badRequest(
        `This question looks like a near-duplicate of an existing one (${Math.round(dup.score * 100)}% similar). Please edit the existing question instead.`,
      );
    }

    // Create question. Manual single-question entries from the contributor UI
    // bypass moderation so the contributor immediately sees them on the bank.
    const { data: question, error: qError } = await adminSupabase
      .from('questions')
      .insert({
        course_id,
        question_text,
        question_type,
        options: question_type === 'mcq' ? options ?? null : null,
        correct_answer: correct_answer ?? null,
        year: year ?? null,
        source_type: 'manual',
        status: 'approved',
        content_hash,
        image_urls: image_urls ?? [],
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

    // Promote a student to contributor only once they've crossed the threshold
    // of approved upload/extraction contributions.
    if (profile.role === 'student') {
      const { data: count } = await adminSupabase.rpc('contributor_question_count', {
        p_user_id: profile.id,
      });
      if (typeof count === 'number' && count >= CONTRIBUTOR_PROMOTION_THRESHOLD) {
        await adminSupabase
          .from('users')
          .update({ role: 'contributor' })
          .eq('id', profile.id);
        await adminSupabase.from('notifications').insert({
          user_id: profile.id,
          title: 'You’re now a contributor',
          body: 'You’ve hit 100 approved contributions. Your wallet is now unlocked and you can withdraw earnings.',
          type: 'role_promotion',
        });
      }
    }

    return created(question, 'Question added to the bank');
  } catch {
    return serverError();
  }
}
