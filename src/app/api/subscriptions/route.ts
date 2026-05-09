import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/utils/auth';
import { initializeTransaction } from '@/lib/paystack/charges';
import { generateReference } from '@/lib/utils/hash';
import { SUBSCRIPTION_PLANS } from '@/lib/subscriptions/plans';
import {
  created, badRequest, unauthorized, serverError, paginated,
} from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';

const schema = z.object({
  plan: z.enum(['monthly', 'quarterly', 'yearly']),
  callback_path: z.string().optional(),
});

// GET /api/subscriptions — own subscriptions paginated.
export async function GET(req: NextRequest) {
  try {
    const { authUser, error } = await getAuthUser();
    if (error || !authUser) return unauthorized();

    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const { from, to } = getPagination(page, limit);

    const admin = createAdminClient();
    const { data, count, error: dbError } = await admin
      .from('subscriptions')
      .select('*', { count: 'exact' })
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (dbError) return serverError(dbError.message);
    return paginated(data ?? [], count ?? 0, page, limit);
  } catch {
    return serverError();
  }
}

// POST /api/subscriptions — start a Paystack-hosted checkout for the chosen plan.
export async function POST(req: NextRequest) {
  try {
    const { authUser, profile, error } = await getAuthUser();
    if (error || !authUser || !profile) return unauthorized();

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const plan = SUBSCRIPTION_PLANS[parsed.data.plan];
    const reference = generateReference('SUB');
    const origin = req.nextUrl.origin;
    const callbackPath = parsed.data.callback_path && parsed.data.callback_path.startsWith('/')
      ? parsed.data.callback_path
      : '/dashboard/subscription/verify';

    const admin = createAdminClient();

    const { data: sub, error: insertErr } = await admin
      .from('subscriptions')
      .insert({
        user_id: authUser.id,
        plan: parsed.data.plan,
        amount: plan.amount,
        currency: 'NGN',
        reference,
        status: 'pending',
      })
      .select()
      .single();
    if (insertErr) return serverError(insertErr.message);

    try {
      const init = await initializeTransaction({
        email: profile.email,
        amount: Math.round(plan.amount * 100),
        reference,
        callback_url: `${origin}${callbackPath}?reference=${reference}`,
        metadata: {
          purpose: 'subscription',
          plan: parsed.data.plan,
          user_id: authUser.id,
        },
      });

      await admin
        .from('subscriptions')
        .update({ paystack_access_code: init.access_code })
        .eq('id', sub.id);

      return created({
        subscription: { ...sub, paystack_access_code: init.access_code },
        authorization_url: init.authorization_url,
        reference: init.reference,
      });
    } catch (err) {
      await admin
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('id', sub.id);
      const msg = err instanceof Error ? err.message : 'Could not start checkout';
      return serverError(msg);
    }
  } catch {
    return serverError();
  }
}
