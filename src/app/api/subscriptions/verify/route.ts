import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/utils/auth';
import { verifyTransaction } from '@/lib/paystack/charges';
import { planEndDate, SUBSCRIPTION_PLANS } from '@/lib/subscriptions/plans';
import { ok, badRequest, unauthorized, notFound, serverError } from '@/lib/utils/response';

const schema = z.object({
  reference: z.string().min(5),
});

// POST /api/subscriptions/verify — confirm a Paystack payment after the user
// returns from the hosted checkout. Idempotent: re-verifying an already-active
// subscription is a no-op that returns the current state.
export async function POST(req: NextRequest) {
  try {
    const { authUser, error } = await getAuthUser();
    if (error || !authUser) return unauthorized();

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const admin = createAdminClient();
    const { data: sub } = await admin
      .from('subscriptions')
      .select('*')
      .eq('reference', parsed.data.reference)
      .eq('user_id', authUser.id)
      .single();
    if (!sub) return notFound('Subscription not found');

    if (sub.status === 'active') {
      return ok(sub, 'Already active');
    }

    let txn;
    try {
      txn = await verifyTransaction(parsed.data.reference);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      return badRequest(msg);
    }

    if (txn.status !== 'success') {
      await admin.from('subscriptions').update({ status: 'cancelled' }).eq('id', sub.id);
      return badRequest(`Payment ${txn.status}. Try again.`);
    }

    const plan = SUBSCRIPTION_PLANS[sub.plan];
    const expectedKobo = Math.round(plan.amount * 100);
    if (txn.amount < expectedKobo) {
      return badRequest('Amount mismatch with selected plan');
    }

    const startsAt = new Date();
    const endsAt = planEndDate(sub.plan, startsAt);

    const { data: updated, error: updErr } = await admin
      .from('subscriptions')
      .update({
        status: 'active',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .eq('id', sub.id)
      .select()
      .single();
    if (updErr) return serverError(updErr.message);

    await admin.from('notifications').insert({
      user_id: authUser.id,
      title: 'Subscription activated',
      body: `Your ${plan.label} plan is active until ${endsAt.toLocaleDateString('en-NG')}.`,
      type: 'subscription',
    });

    return ok(updated, 'Subscription activated');
  } catch {
    return serverError();
  }
}
