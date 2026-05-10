import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { unauthorized, serverError, paginated } from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';

// GET /api/admin/questions?status=pending&course_id=&page=&limit=
export async function GET(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized();

    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status') ?? 'pending';
    const course_id = searchParams.get('course_id');
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const { from, to } = getPagination(page, limit);

    const supabase = createAdminClient();
    let query = supabase
      .from('questions')
      .select(
        `*, courses(name, school, department), question_contributions(user_id, contribution_type, contribution_weight, users(full_name, email))`,
        { count: 'exact' },
      )
      .eq('status', status as 'pending' | 'approved' | 'rejected')
      .eq('is_deleted', false);

    if (course_id) query = query.eq('course_id', course_id);

    const { data, count, error: dbError } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (dbError) return serverError(dbError.message);

    type Row = Record<string, unknown> & {
      id: string;
      group_id: string | null;
      part_label: string | null;
      position: number | null;
      created_at: string;
    };
    const rows = (data ?? []) as Row[];

    // Pull stems + sibling parts for any returned multi-part question, so the
    // admin sees the whole group together (stem + every part, regardless of
    // each part's individual moderation status).
    const groupIds = Array.from(
      new Set(rows.map((r) => r.group_id).filter((g): g is string => !!g)),
    );
    const groupById = new Map<string, { id: string; stem: string; stem_image_urls: unknown }>();
    if (groupIds.length > 0) {
      const { data: groups } = await supabase
        .from('question_groups')
        .select('id, stem, stem_image_urls')
        .in('id', groupIds);
      for (const g of groups ?? []) groupById.set(g.id, g);

      const haveIds = new Set(rows.map((r) => r.id));
      const { data: siblings } = await supabase
        .from('questions')
        .select(
          `*, courses(name, school, department), question_contributions(user_id, contribution_type, contribution_weight, users(full_name, email))`,
        )
        .in('group_id', groupIds)
        .eq('is_deleted', false);
      for (const s of (siblings ?? []) as Row[]) {
        if (!haveIds.has(s.id)) {
          rows.push(s);
          haveIds.add(s.id);
        }
      }
    }

    // Stable order: cluster grouped parts by group_id (preserving the order in
    // which the group's first part appeared on this page), part_position
    // ascending; standalones keep their created_at desc order.
    const groupFirstSeen = new Map<string, number>();
    rows.forEach((r, i) => {
      if (r.group_id && !groupFirstSeen.has(r.group_id)) groupFirstSeen.set(r.group_id, i);
    });
    rows.sort((a, b) => {
      const ag = a.group_id ? groupFirstSeen.get(a.group_id) ?? 0 : -1;
      const bg = b.group_id ? groupFirstSeen.get(b.group_id) ?? 0 : -1;
      if (a.group_id && b.group_id && a.group_id === b.group_id) {
        return (a.position ?? 0) - (b.position ?? 0);
      }
      // Use the group's "first seen" index as the sort key for grouped rows;
      // standalone rows keep their per-row index. Falls back to created_at.
      const ai = a.group_id ? ag : rows.indexOf(a);
      const bi = b.group_id ? bg : rows.indexOf(b);
      return ai - bi;
    });

    // Annotate each row with its group stem so the admin UI can render it.
    const enriched = rows.map((r) => {
      if (r.group_id && groupById.has(r.group_id)) {
        return { ...r, group: groupById.get(r.group_id) ?? null };
      }
      return { ...r, group: null };
    });

    return paginated(enriched, count ?? 0, page, limit);
  } catch {
    return serverError();
  }
}
