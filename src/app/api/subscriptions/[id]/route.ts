import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/utils/auth';
import { ok, badRequest, unauthorized, notFound, serverError } from '@/lib/utils/response';

// DELETE /api/subscriptions/[id] — cancel an active or pending subscription.
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

    const { data: row } = await admin
      .from('subscriptions')
      .select('id, user_id, status')
      .eq('id', id)
      .eq('user_id', authUser.id)
      .single();
    if (!row) return notFound('Subscription not found');

    if (row.status === 'expired' || row.status === 'cancelled') {
      return badRequest('This subscription is already inactive');
    }

    const { error: updErr } = await admin
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', id);
    if (updErr) return serverError(updErr.message);

    return ok(null, 'Subscription cancelled');
  } catch {
    return serverError();
  }
}
