import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { ok, badRequest, unauthorized, notFound, serverError } from '@/lib/utils/response';

const schema = z.object({
  status: z.enum(['approved', 'rejected']),
  reason: z.string().optional(),
});

// POST /api/admin/questions/[id]/moderate
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized();

    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const supabase = createAdminClient();
    const { data, error: dbError } = await supabase
      .from('questions')
      .update({ status: parsed.data.status })
      .eq('id', id)
      .eq('is_deleted', false)
      .select('id, status, course_id, question_contributions(user_id)')
      .single();

    if (dbError || !data) return notFound('Question not found');

    // Notify contributors
    const contributors = (data.question_contributions as unknown as { user_id: string }[]) ?? [];
    if (contributors.length) {
      const statusText = parsed.data.status === 'approved' ? 'approved' : 'rejected';
      const notifications = contributors.map((c) => ({
        user_id: c.user_id,
        title: `Question ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
        body:
          parsed.data.status === 'approved'
            ? 'Your submitted question has been approved and is now live!'
            : `Your submitted question was rejected. ${parsed.data.reason ?? ''}`,
        type: 'moderation',
        metadata: { question_id: id, status: parsed.data.status },
      }));
      await supabase.from('notifications').insert(notifications);
    }

    return ok(data, `Question ${parsed.data.status}`);
  } catch {
    return serverError();
  }
}
