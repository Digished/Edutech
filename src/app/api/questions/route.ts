import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { loadAccessSummary } from '@/lib/access/gate';
import {
  created, badRequest, unauthorized, serverError, paginated,
} from '@/lib/utils/response';
import { friendlyZodError } from '@/lib/utils/friendly-errors';
import { getPagination } from '@/lib/utils/pagination';
import { hashQuestionText } from '@/lib/utils/hash';
import { detectDuplicates, findDuplicateMatch } from '@/lib/dedup/similarity';

const partSchema = z.object({
  part_label: z.string().trim().max(8).optional(),
  question_text: z.string().min(2),
  correct_answer: z.string().nullable().optional(),
  image_urls: z.array(z.string().url()).max(8).optional(),
});

const schema = z.object({
  course_id: z.string().uuid(),
  question_text: z.string().min(5).optional(),
  question_type: z.enum(['mcq', 'theory']).default('mcq'),
  options: z
    .record(z.string(), z.string())
    .nullable()
    .optional(),
  correct_answer: z.string().nullable().optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  level: z.union([z.literal(100), z.literal(200), z.literal(300), z.literal(400), z.literal(500), z.literal(600)]).nullable().optional(),
  semester: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable().optional(),
  image_urls: z.array(z.string().url()).max(8).optional(),
  // Multi-part theory: shared stem with one or more sub-parts.
  stem: z.string().min(5).optional(),
  stem_image_urls: z.array(z.string().url()).max(8).optional(),
  parts: z.array(partSchema).min(1).max(20).optional(),
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
    const faculty = searchParams.get('faculty');
    const universityId = searchParams.get('university_id');
    const facultyId = searchParams.get('faculty_id');
    const departmentId = searchParams.get('department_id');
    const year = searchParams.get('year');
    const level = searchParams.get('level');
    const semester = searchParams.get('semester');
    const question_type = searchParams.get('question_type');
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const { from, to } = getPagination(page, limit);

    const adminClient = createAdminClient();

    // Resolve the course IDs the user is allowed to see, then filter questions
    // by course_id. Cleaner than trying to do multi-column IN over a join.
    let allowedCourseIds: string[] | null = null;
    if (!access.hasFullAccess) {
      const facultyIds = access.unlocked.map((u) => u.faculty_id);
      if (facultyIds.length === 0) {
        return paginated([], 0, 1, limit, { unlocked: access.unlocked });
      }
      const { data: rows, error: courseErr } = await adminClient
        .from('courses')
        .select('id')
        .in('faculty_id', facultyIds);
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
    if (level) query = query.eq('level', parseInt(level));
    if (semester) query = query.eq('semester', parseInt(semester));
    if (question_type === 'mcq' || question_type === 'theory') {
      query = query.eq('question_type', question_type);
    }
    // Course-level filters: text or FK ids both narrow the course set.
    if (school || department || faculty || universityId || facultyId || departmentId) {
      let join = supabase.from('courses').select('id');
      if (universityId) join = join.eq('university_id', universityId);
      if (facultyId)    join = join.eq('faculty_id', facultyId);
      if (departmentId) join = join.eq('department_id', departmentId);
      if (school)       join = join.eq('school', school);
      if (faculty)      join = join.eq('faculty', faculty);
      if (department)   join = join.eq('department', department);
      const { data: filteredCourses } = await join;
      const filteredIds = (filteredCourses ?? []).map((c) => c.id);
      query = query.in('course_id', filteredIds.length > 0 ? filteredIds : ['00000000-0000-0000-0000-000000000000']);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return serverError(error.message);

    let rows = data ?? [];

    // If the caller wants every part of any returned multi-part question, look
    // up sibling parts and merge them in. Used by the practice picker so a
    // grouped question is never delivered with missing parts.
    const wantGroupComplete = searchParams.get('group_complete') === '1';
    if (wantGroupComplete && rows.length > 0) {
      const groupIds = Array.from(
        new Set(
          rows
            .map((r) => (r as unknown as { group_id: string | null }).group_id)
            .filter((g): g is string => !!g),
        ),
      );
      if (groupIds.length > 0) {
        const haveIds = new Set(rows.map((r) => (r as unknown as { id: string }).id));
        const { data: siblings } = await supabase
          .from('questions')
          .select(`*, courses(name, school, department, code), question_analytics(views_count, last_viewed_at)`)
          .eq('status', 'approved')
          .eq('is_deleted', false)
          .in('group_id', groupIds);
        for (const s of siblings ?? []) {
          if (!haveIds.has((s as unknown as { id: string }).id)) {
            rows.push(s);
            haveIds.add((s as unknown as { id: string }).id);
          }
        }
      }
    }

    const sanitized = rows.map((row) => {
      const { correct_answer: _omit, ...rest } = row as Record<string, unknown>;
      void _omit;
      return rest;
    });
    return paginated(sanitized, count ?? 0, page, limit, { unlocked: access.unlocked });
  } catch {
    return serverError();
  }
}

// POST /api/questions — students may submit (for review); they get the contributor
// role once they have 100 approved upload/extraction contributions.
export async function POST(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

    const { course_id, question_text, question_type, options, correct_answer, year, level, semester, image_urls, stem, stem_image_urls, parts } = parsed.data;

    const isMultiPart = !!(stem && parts && parts.length > 0);
    if (!isMultiPart && (!question_text || question_text.trim().length < 5)) {
      return badRequest('Write the question');
    }
    if (isMultiPart && question_type !== 'theory') {
      return badRequest('Multi-part questions must be theory questions');
    }
    if (question_type === 'mcq' && (!options || Object.keys(options).length < 2)) {
      return badRequest('Add at least two options for an MCQ');
    }

    const adminSupabase = createAdminClient();

    // ---------- multi-part theory branch ----------
    if (isMultiPart) {
      // Reject duplicate sub-parts within the same course.
      for (const p of parts!) {
        const dup = await findDuplicateMatch(p.question_text, course_id);
        if (dup) {
          return badRequest(
            `Part "${p.part_label ?? p.question_text.slice(0, 40)}" looks like a near-duplicate of an existing question (${Math.round(dup.score * 100)}% similar).`,
          );
        }
      }

      const { data: group, error: gErr } = await adminSupabase
        .from('question_groups')
        .insert({
          course_id,
          stem: stem!,
          stem_image_urls: stem_image_urls ?? [],
          year: year ?? null,
          level: level ?? null,
          semester: semester ?? null,
          source_type: 'manual',
          status: 'pending',
        })
        .select('id')
        .single();
      if (gErr || !group) return serverError(gErr?.message ?? 'Could not create question group');

      const inserted: { id: string }[] = [];
      for (let i = 0; i < parts!.length; i++) {
        const p = parts![i];
        const partHash = hashQuestionText(p.question_text);
        const { data: q, error: qErr } = await adminSupabase
          .from('questions')
          .insert({
            course_id,
            group_id: group.id,
            part_label: p.part_label ?? null,
            position: i + 1,
            question_text: p.question_text,
            question_type: 'theory',
            options: null,
            correct_answer: p.correct_answer ?? null,
            year: year ?? null,
            level: level ?? null,
            semester: semester ?? null,
            source_type: 'manual',
            status: 'pending',
            content_hash: partHash,
            image_urls: p.image_urls ?? [],
          })
          .select('id, question_text, course_id')
          .single();
        if (qErr || !q) return serverError(qErr?.message ?? 'Could not create question part');

        await adminSupabase.from('question_contributions').insert({
          question_id: q.id,
          user_id: profile.id,
          contribution_type: 'upload',
          contribution_weight: 1.0,
        });
        detectDuplicates(q.id, p.question_text, course_id).catch(() => null);
        inserted.push({ id: q.id });
      }

      return created({ group_id: group.id, question_ids: inserted.map((x) => x.id) }, `Submitted ${inserted.length} parts for review`);
    }

    // ---------- standalone branch ----------
    const content_hash = hashQuestionText(question_text!);

    const dup = await findDuplicateMatch(question_text!, course_id);
    if (dup) {
      return badRequest(
        `This question looks like a near-duplicate of an existing one (${Math.round(dup.score * 100)}% similar). Please edit the existing question instead.`,
      );
    }

    const { data: question, error: qError } = await adminSupabase
      .from('questions')
      .insert({
        course_id,
        question_text: question_text!,
        question_type,
        options: question_type === 'mcq' ? options ?? null : null,
        correct_answer: correct_answer ?? null,
        year: year ?? null,
        level: level ?? null,
        semester: semester ?? null,
        source_type: 'manual',
        status: 'pending',
        content_hash,
        image_urls: image_urls ?? [],
      })
      .select()
      .single();

    if (qError) return serverError(qError.message);

    await adminSupabase.from('question_contributions').insert({
      question_id: question.id,
      user_id: profile.id,
      contribution_type: 'upload',
      contribution_weight: 1.0,
    });

    detectDuplicates(question.id, question_text!, course_id).catch(() => null);

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

    return created(question, 'Question submitted for review');
  } catch {
    return serverError();
  }
}
