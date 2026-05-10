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
import { friendlyZodError } from '@/lib/utils/friendly-errors';
import { getPagination } from '@/lib/utils/pagination';

// One-shot checkout buys access to one or more faculties at the chosen plan.
// Each faculty becomes a row in the subscriptions table; all rows share the
// same Paystack `reference` so they activate together when the charge succeeds.
const schema = z.object({
  plan: z.enum(['monthly', 'quarterly', 'yearly']),
  faculty_ids: z.array(z.string().uuid()).min(1).max(20),
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

export async function POST(req: NextRequest) {
  try {
    const { authUser, profile, error } = await getAuthUser();
    if (error || !authUser || !profile) return unauthorized();

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

    const requestedFacultyIds = Array.from(new Set(parsed.data.faculty_ids));

    const isContributor = profile.role === 'contributor' || profile.role === 'admin';
    const admin = createAdminClient();

    // Resolve faculty + university for each id so the row carries the full pointer.
    const { data: facultyRows, error: facErr } = await admin
      .from('faculties')
      .select('id, name, university_id, universities(id, name)')
      .in('id', requestedFacultyIds);
    if (facErr) return serverError(facErr.message);

    type FacultyRow = {
      id: string;
      name: string;
      university_id: string;
      universities: { id: string; name: string } | null;
    };
    const faculties = (facultyRows ?? []) as unknown as FacultyRow[];
    if (faculties.length !== requestedFacultyIds.length) {
      return badRequest('We couldn’t find one of the faculties you picked. Try again.');
    }

    // Skip faculties already active so users don't double-pay.
    const { data: alreadyActive } = await admin.rpc('list_unlocked_faculties', {
      p_user_id: authUser.id,
    });
    const activeIds = new Set((alreadyActive ?? []).map((r) => r.faculty_id));
    const fresh = faculties.filter((f) => !activeIds.has(f.id));
    if (fresh.length === 0) {
      return badRequest('You already have access to every faculty you selected.');
    }

    const reference = generateReference('SUB');
    const origin = req.nextUrl.origin;
    const callbackPath = parsed.data.callback_path && parsed.data.callback_path.startsWith('/')
      ? parsed.data.callback_path
      : '/dashboard/subscription/verify';

    const freshPricing = priceBundle(parsed.data.plan, fresh.length, isContributor);
    const freshPerRow = paidShareForCombo(parsed.data.plan, fresh.length, isContributor);

    const rows = fresh.map((f) => ({
      user_id: authUser.id,
      plan: parsed.data.plan,
      amount: freshPerRow,
      currency: 'NGN',
      reference,
      status: 'pending' as const,
      university_id: f.university_id,
      faculty_id: f.id,
      department_id: null,
      school: f.universities?.name ?? null,
      faculty: f.name,
      department: null,
      contributor_discount_applied: isContributor,
    }));

    const { data: insertedRows, error: insertErr } = await admin
      .from('subscriptions')
      .insert(rows)
      .select('id, faculty, faculty_id, school');
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
          faculty_count: fresh.length,
          contributor_discount: isContributor,
        },
      });

      await admin
        .from('subscriptions')
        .update({ paystack_access_code: init.access_code })
        .eq('reference', reference);

      return created({
        rows: insertedRows ?? [],
        pricing: {
          ...freshPricing,
          attempted: requestedFacultyIds.length,
          billable: fresh.length,
        },
        skipped: requestedFacultyIds.length - fresh.length,
        authorization_url: init.authorization_url,
        reference: init.reference,
      });
    } catch {
      await admin
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('reference', reference);
      return serverError('We couldn’t start the checkout. Please try again.');
    }
  } catch {
    return serverError();
  }
}
