import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { ok, badRequest, unauthorized, serverError } from '@/lib/utils/response';
import { friendlyZodError } from '@/lib/utils/friendly-errors';

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  status: z.enum(['approved', 'rejected']),
  reason: z.string().optional(),
});

// POST /api/admin/questions/bulk-moderate — bulk approve / reject pending
// questions. Notifies each contributor once per affected question.
export async function POST(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized();

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

    const { ids, status, reason } = parsed.data;
    const supabase = createAdminClient();

    const { data: updated, error: updErr } = await supabase
      .from('questions')
      .update({ status })
      .in('id', ids)
      .eq('is_deleted', false)
      .select('id, question_contributions(user_id)');

    if (updErr) return serverError(updErr.message);

    const rows = (updated ?? []) as unknown as {
      id: string;
      question_contributions: { user_id: string }[];
    }[];

    const statusText = status === 'approved' ? 'Approved' : 'Rejected';
    const notifications: {
      user_id: string;
      title: string;
      body: string;
      type: string;
      metadata: Record<string, unknown>;
    }[] = [];
    for (const row of rows) {
      for (const c of row.question_contributions ?? []) {
        notifications.push({
          user_id: c.user_id,
          title: `Question ${statusText}`,
          body:
            status === 'approved'
              ? 'Your submitted question has been approved and is now live.'
              : `Your submitted question was rejected. ${reason ?? ''}`.trim(),
          type: 'moderation',
          metadata: { question_id: row.id, status },
        });
      }
    }
    if (notifications.length) {
      await supabase.from('notifications').insert(notifications);
    }

    return ok({ updated: rows.length }, `${statusText} ${rows.length} question${rows.length === 1 ? '' : 's'}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bulk moderation failed';
    return serverError(message);
  }
}
