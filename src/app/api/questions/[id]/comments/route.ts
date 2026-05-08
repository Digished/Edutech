import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser, requireRole } from '@/lib/utils/auth';
import { created, badRequest, unauthorized, notFound, serverError, paginated } from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';

interface RawComment {
  id: string;
  question_id: string;
  user_id: string;
  body: string;
  is_anonymous: boolean;
  created_at: string;
  users: { full_name: string | null } | null;
}

interface PublicComment {
  id: string;
  question_id: string;
  body: string;
  is_anonymous: boolean;
  created_at: string;
  author: string;
  is_mine: boolean;
}

const schema = z.object({
  body: z.string().min(1).max(4000),
  is_anonymous: z.boolean().optional(),
});

// GET — public list (anonymized). Auth optional; logged-in users get an
// is_mine flag so they can manage their own comments.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '50');
    const { from, to } = getPagination(page, limit);

    const supabase = await createClient();
    const { authUser } = await getAuthUser();

    const { data, count, error: dbError } = await supabase
      .from('question_comments')
      .select(
        'id, question_id, user_id, body, is_anonymous, created_at, users(full_name)',
        { count: 'exact' },
      )
      .eq('question_id', id)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (dbError) return serverError(dbError.message);

    const sanitized: PublicComment[] = ((data ?? []) as unknown as RawComment[]).map((c) => ({
      id: c.id,
      question_id: c.question_id,
      body: c.body,
      is_anonymous: c.is_anonymous,
      created_at: c.created_at,
      author: c.is_anonymous ? 'Anonymous student' : (c.users?.full_name ?? 'Student'),
      is_mine: !!authUser && authUser.id === c.user_id,
    }));

    return paginated(sanitized, count ?? 0, page, limit);
  } catch {
    return serverError();
  }
}

// POST — submit a comment (auth required). Default anonymous = true.
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
      .select('id, is_deleted, status')
      .eq('id', id)
      .single();
    if (!question || question.is_deleted || question.status !== 'approved') {
      return notFound('Question not found');
    }

    const { data, error: dbError } = await supabase
      .from('question_comments')
      .insert({
        question_id: id,
        user_id: profile.id,
        body: parsed.data.body,
        is_anonymous: parsed.data.is_anonymous ?? true,
      })
      .select('id, question_id, body, is_anonymous, created_at')
      .single();

    if (dbError) return serverError(dbError.message);
    return created({
      ...data,
      author: (parsed.data.is_anonymous ?? true) ? 'Anonymous student' : (profile.full_name ?? 'Student'),
      is_mine: true,
    });
  } catch {
    return serverError();
  }
}
