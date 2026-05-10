import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/utils/auth';
import { verifyTransaction } from '@/lib/paystack/charges';
import { planEndDate, SUBSCRIPTION_PLANS } from '@/lib/subscriptions/plans';
import { ok, badRequest, unauthorized, notFound, serverError } from '@/lib/utils/response';
import { friendlyZodError } from '@/lib/utils/friendly-errors';

const schema = z.object({
  reference: z.string().min(5),
});

// POST /api/subscriptions/verify — confirm a Paystack payment after the user
// returns from the hosted checkout. Idempotent: re-verifying an already-active
// bundle is a no-op.
export async function POST(req: NextRequest) {
  try {
    const { authUser, error } = await getAuthUser();
    if (error || !authUser) return unauthorized();

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

    const admin = createAdminClient();
    const { data: rows } = await admin
      .from('subscriptions')
      .select('*')
      .eq('reference', parsed.data.reference)
      .eq('user_id', authUser.id);
    if (!rows || rows.length === 0) return notFound('Subscription not found');

    const allActive = rows.every((r) => r.status === 'active');
    if (allActive) return ok({ rows, already_active: true }, 'Already active');

    let txn;
    try {
      txn = await verifyTransaction(parsed.data.reference);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      return badRequest(msg);
    }

    if (txn.status !== 'success') {
      await admin
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('reference', parsed.data.reference);
      return badRequest(`Payment ${txn.status}. Try again.`);
    }

    // Sanity check on the amount: the sum of paid_share across rows must match
    // what Paystack actually collected (kobo).
    const expectedKobo = Math.round(rows.reduce((s, r) => s + Number(r.amount), 0) * 100);
    if (txn.amount + 100 < expectedKobo) {
      // Allow ~₦1 tolerance for rounding.
      return badRequest('Amount mismatch with bundle');
    }

    const startsAt = new Date();
    const plan = rows[0].plan;
    const endsAt = planEndDate(plan, startsAt);

    const { data: updated, error: updErr } = await admin
      .from('subscriptions')
      .update({
        status: 'active',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .eq('reference', parsed.data.reference)
      .select();
    if (updErr) return serverError(updErr.message);

    const planLabel = SUBSCRIPTION_PLANS[plan].label;
    const facultyList = rows.map((r) => r.faculty ?? 'a faculty').join(', ');
    await admin.from('notifications').insert({
      user_id: authUser.id,
      title: 'Subscription activated',
      body: `Your ${planLabel} plan is active for: ${facultyList}. Expires ${endsAt.toLocaleDateString('en-NG')}.`,
      type: 'subscription',
    });

    return ok(updated ?? [], 'Subscription activated');
  } catch {
    return serverError();
  }
}
