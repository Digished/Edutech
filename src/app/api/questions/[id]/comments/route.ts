import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser, requireRole } from '@/lib/utils/auth';
import { created, badRequest, unauthorized, notFound, serverError, paginated } from '@/lib/utils/response';
import { friendlyZodError } from '@/lib/utils/friendly-errors';
import { getPagination } from '@/lib/utils/pagination';

interface RawComment {
  id: string;
  question_id: string;
  user_id: string;
  body: string;
  is_anonymous: boolean;
  pinned: boolean;
  created_at: string;
  users: { full_name: string | null } | null;
}

interface PublicComment {
  id: string;
  question_id: string;
  body: string;
  is_anonymous: boolean;
  pinned: boolean;
  upvote_count: number;
  has_upvoted: boolean;
  can_pin: boolean;
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
    const { authUser, profile } = await getAuthUser();

    const { data, count, error: dbError } = await supabase
      .from('question_comments')
      .select(
        'id, question_id, user_id, body, is_anonymous, pinned, created_at, users(full_name)',
        { count: 'exact' },
      )
      .eq('question_id', id)
      .eq('is_hidden', false)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: true })
      .range(from, to);

    if (dbError) return serverError(dbError.message);

    const rows = ((data ?? []) as unknown as RawComment[]);
    const commentIds = rows.map((c) => c.id);

    // Aggregate upvote counts + the current user's upvotes in two cheap queries.
    const upvoteCounts = new Map<string, number>();
    const myUpvotes = new Set<string>();
    if (commentIds.length > 0) {
      const { data: upvoteRows } = await supabase
        .from('comment_upvotes')
        .select('comment_id, user_id')
        .in('comment_id', commentIds);
      for (const u of upvoteRows ?? []) {
        upvoteCounts.set(u.comment_id, (upvoteCounts.get(u.comment_id) ?? 0) + 1);
        if (authUser && u.user_id === authUser.id) myUpvotes.add(u.comment_id);
      }
    }

    let canPin = profile?.role === 'admin';
    if (!canPin && authUser) {
      const { data: contrib } = await supabase
        .from('question_contributions')
        .select('user_id')
        .eq('question_id', id)
        .eq('user_id', authUser.id)
        .in('contribution_type', ['upload', 'extraction'])
        .maybeSingle();
      canPin = !!contrib;
    }

    const sanitized: PublicComment[] = rows.map((c) => ({
      id: c.id,
      question_id: c.question_id,
      body: c.body,
      is_anonymous: c.is_anonymous,
      pinned: c.pinned,
      upvote_count: upvoteCounts.get(c.id) ?? 0,
      has_upvoted: myUpvotes.has(c.id),
      can_pin: canPin,
      created_at: c.created_at,
      author: c.is_anonymous ? 'Anonymous student' : (c.users?.full_name ?? 'Student'),
      is_mine: !!authUser && authUser.id === c.user_id,
    }));

    // Re-sort: pinned first, then upvote_count desc, then created_at asc.
    sanitized.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.upvote_count !== b.upvote_count) return b.upvote_count - a.upvote_count;
      return a.created_at.localeCompare(b.created_at);
    });

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
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

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
      pinned: false,
      upvote_count: 0,
      has_upvoted: false,
      can_pin: profile.role === 'admin',
      author: (parsed.data.is_anonymous ?? true) ? 'Anonymous student' : (profile.full_name ?? 'Student'),
      is_mine: true,
    });
  } catch {
    return serverError();
  }
}
