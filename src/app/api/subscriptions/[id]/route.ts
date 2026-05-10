import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/utils/auth';
import { ok, badRequest, unauthorized, notFound, serverError } from '@/lib/utils/response';

// DELETE /api/subscriptions/[id] — cancel by faculty_id (preferred) or row id.
// Cancelling an active subscription stops it from being treated as unlocked
// going forward; we don't refund. Pending rows are cleaned up so a stuck
// checkout can be discarded.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authUser, error } = await getAuthUser();
    if (error || !authUser) return unauthorized();

    const { id } = await params;
    const admin = createAdminClient();

    // Try faculty_id first — that's how the dashboard cancels.
    const { data: byFaculty } = await admin
      .from('subscriptions')
      .select('id, status')
      .eq('user_id', authUser.id)
      .eq('faculty_id', id)
      .in('status', ['active', 'pending']);

    let toCancel: string[] = (byFaculty ?? []).map((r) => r.id);

    if (toCancel.length === 0) {
      const { data: byId } = await admin
        .from('subscriptions')
        .select('id, status')
        .eq('user_id', authUser.id)
        .eq('id', id)
        .single();
      if (!byId) return notFound('Subscription not found.');
      if (byId.status === 'expired' || byId.status === 'cancelled') {
        return badRequest('This subscription is already inactive.');
      }
      toCancel = [byId.id];
    }

    const { error: updErr } = await admin
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .in('id', toCancel);
    if (updErr) return serverError(updErr.message);

    return ok(null, 'Subscription cancelled');
  } catch {
    return serverError();
  }
}
