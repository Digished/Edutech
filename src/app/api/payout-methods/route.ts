import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/utils/auth';
import { verifyAccountNumber, createTransferRecipient } from '@/lib/paystack/transfers';
import { ok, created, badRequest, unauthorized, notFound, serverError } from '@/lib/utils/response';

const upsertSchema = z.object({
  bank_code: z.string().min(2),
  bank_name: z.string().optional(),
  account_number: z.string().regex(/^\d{10}$/, 'Account number must be 10 digits'),
  set_default: z.boolean().optional(),
});

// GET /api/payout-methods — list saved methods for current user.
export async function GET() {
  try {
    const { authUser, error } = await getAuthUser();
    if (error || !authUser) return unauthorized();

    const admin = createAdminClient();
    const { data, error: dbError } = await admin
      .from('payout_methods')
      .select('*')
      .eq('user_id', authUser.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (dbError) return serverError(dbError.message);
    return ok(data ?? []);
  } catch {
    return serverError();
  }
}

// POST /api/payout-methods — verify the account through Paystack, create a
// transfer recipient and persist it for next time.
export async function POST(req: NextRequest) {
  try {
    const { authUser, error } = await getAuthUser();
    if (error || !authUser) return unauthorized();

    const body = await req.json();
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const { bank_code, account_number, bank_name, set_default } = parsed.data;

    let account_name: string;
    try {
      const verified = await verifyAccountNumber(account_number, bank_code);
      account_name = verified.account_name;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not verify account';
      return badRequest(msg);
    }

    let recipient_code: string | null = null;
    try {
      const recipient = await createTransferRecipient({
        type: 'nuban',
        name: account_name,
        account_number,
        bank_code,
        currency: 'NGN',
      });
      recipient_code = recipient.recipient_code;
    } catch {
      // Save the method anyway — recipient can be (re)created at withdrawal time.
    }

    const admin = createAdminClient();

    if (set_default !== false) {
      await admin
        .from('payout_methods')
        .update({ is_default: false })
        .eq('user_id', authUser.id);
    }

    const { data, error: dbError } = await admin
      .from('payout_methods')
      .upsert(
        {
          user_id: authUser.id,
          bank_code,
          bank_name: bank_name ?? null,
          account_number,
          account_name,
          recipient_code,
          is_default: set_default !== false,
        },
        { onConflict: 'user_id,bank_code,account_number' },
      )
      .select()
      .single();
    if (dbError) return serverError(dbError.message);

    return created(data, 'Payout method saved');
  } catch {
    return serverError();
  }
}

// DELETE /api/payout-methods?id=
export async function DELETE(req: NextRequest) {
  try {
    const { authUser, error } = await getAuthUser();
    if (error || !authUser) return unauthorized();

    const id = req.nextUrl.searchParams.get('id');
    if (!id) return badRequest('id is required');

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from('payout_methods')
      .select('id')
      .eq('id', id)
      .eq('user_id', authUser.id)
      .single();
    if (!existing) return notFound('Payout method not found');

    await admin.from('payout_methods').delete().eq('id', id);
    return ok(null, 'Removed');
  } catch {
    return serverError();
  }
}
