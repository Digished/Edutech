import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/utils/auth';
import { initializeTransaction } from '@/lib/paystack/charges';
import { generateReference } from '@/lib/utils/hash';
import { paidShareForCombo, priceBundle } from '@/lib/subscriptions/plans';
import {
  created, badRequest, unauthorized, serverError, paginated,
} from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';

const comboSchema = z.object({
  school: z.string().min(2),
  department: z.string().min(2),
});

const schema = z.object({
  plan: z.enum(['monthly', 'quarterly', 'yearly']),
  combos: z.array(comboSchema).min(1).max(20),
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

// POST /api/subscriptions — start a Paystack checkout that will unlock the
// chosen list of (school, department) combos. Each combo becomes one row in
// the subscriptions table; all rows share the same Paystack `reference` so
// they activate together when the charge succeeds.
export async function POST(req: NextRequest) {
  try {
    const { authUser, profile, error } = await getAuthUser();
    if (error || !authUser || !profile) return unauthorized();

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    // Dedup combos within a single checkout.
    const seen = new Set<string>();
    const combos = parsed.data.combos.filter((c) => {
      const key = `${c.school}::${c.department}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (combos.length === 0) return badRequest('Pick at least one department');

    const isContributor = profile.role === 'contributor' || profile.role === 'admin';

    const reference = generateReference('SUB');
    const origin = req.nextUrl.origin;
    const callbackPath = parsed.data.callback_path && parsed.data.callback_path.startsWith('/')
      ? parsed.data.callback_path
      : '/dashboard/subscription/verify';

    const admin = createAdminClient();

    // Skip combos the user already has active — no point double-paying.
    const { data: alreadyActive } = await admin.rpc('list_unlocked_departments', {
      p_user_id: authUser.id,
    });
    const activeKeys = new Set(
      (alreadyActive ?? []).map((r) => `${r.school}::${r.department}`),
    );
    const fresh = combos.filter((c) => !activeKeys.has(`${c.school}::${c.department}`));
    if (fresh.length === 0) {
      return badRequest('You already have active access to every department you selected');
    }

    const freshPricing = priceBundle(parsed.data.plan, fresh.length, isContributor);
    const freshPerRow = paidShareForCombo(parsed.data.plan, fresh.length, isContributor);

    const rows = fresh.map((c) => ({
      user_id: authUser.id,
      plan: parsed.data.plan,
      amount: freshPerRow,
      currency: 'NGN',
      reference,
      status: 'pending' as const,
      school: c.school,
      department: c.department,
      contributor_discount_applied: isContributor,
    }));

    const { data: insertedRows, error: insertErr } = await admin
      .from('subscriptions')
      .insert(rows)
      .select('id, school, department');
    if (insertErr) return serverError(insertErr.message);

    try {
      const init = await initializeTransaction({
        email: profile.email,
        amount: Math.round(freshPricing.net * 100),
        reference,
        callback_url: `${origin}${callbackPath}?reference=${reference}`,
        metadata: {
          purpose: 'subscription',
          plan: parsed.data.plan,
          user_id: authUser.id,
          combo_count: fresh.length,
          contributor_discount: isContributor,
        },
      });

      await admin
        .from('subscriptions')
        .update({ paystack_access_code: init.access_code })
        .eq('reference', reference);

      return created({
        rows: insertedRows ?? [],
        pricing: { ...freshPricing, attempted: combos.length, billable: fresh.length },
        skipped_combos: combos.length - fresh.length,
        authorization_url: init.authorization_url,
        reference: init.reference,
      });
    } catch (err) {
      await admin
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('reference', reference);
      const msg = err instanceof Error ? err.message : 'Could not start checkout';
      return serverError(msg);
    }
  } catch {
    return serverError();
  }
}

