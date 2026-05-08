import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/utils/auth';
import { ok, created, badRequest, unauthorized, serverError, paginated } from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';
import {
  createTransferRecipient,
  initiateTransfer,
  verifyAccountNumber,
} from '@/lib/paystack/transfers';
import { generateReference } from '@/lib/utils/hash';

const MIN_WITHDRAWAL = 1000; // ₦1,000 minimum

const schema = z.object({
  amount: z.number().min(MIN_WITHDRAWAL, `Minimum withdrawal is ₦${MIN_WITHDRAWAL}`),
  bank_account_number: z.string().length(10),
  bank_code: z.string().min(3),
});

// GET /api/withdrawals
export async function GET(req: NextRequest) {
  try {
    const { authUser, error } = await getAuthUser();
    if (error || !authUser) return unauthorized();

    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const { from, to } = getPagination(page, limit);

    const supabase = await createClient();
    const { data, count, error: dbError } = await supabase
      .from('withdrawals')
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

// POST /api/withdrawals — initiate withdrawal
export async function POST(req: NextRequest) {
  try {
    const { authUser, error } = await getAuthUser();
    if (error || !authUser) return unauthorized();

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const { amount, bank_account_number, bank_code } = parsed.data;

    const adminSupabase = createAdminClient();

    // Check balance
    const { data: balance } = await adminSupabase.rpc('get_wallet_balance', {
      p_user_id: authUser.id,
    });

    if ((balance ?? 0) < amount) {
      return badRequest(`Insufficient balance. Available: ₦${balance ?? 0}`);
    }

    // Verify bank account via Paystack
    let account_name: string;
    try {
      const verified = await verifyAccountNumber(bank_account_number, bank_code);
      account_name = verified.account_name;
    } catch {
      return badRequest('Could not verify bank account. Check account number and bank code.');
    }

    // Create Paystack transfer recipient
    let recipient_code: string;
    try {
      const recipient = await createTransferRecipient({
        type: 'nuban',
        name: account_name,
        account_number: bank_account_number,
        bank_code,
        currency: 'NGN',
      });
      recipient_code = recipient.recipient_code;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create recipient';
      return serverError(msg);
    }

    const reference = generateReference('WDR');

    // Create debit ledger entry (pending)
    await adminSupabase.from('wallet_ledger').insert({
      user_id: authUser.id,
      amount,
      currency: 'NGN',
      type: 'debit',
      status: 'pending',
      reason: 'withdrawal',
      reference_id: reference,
    });

    // Create withdrawal record
    const { data: withdrawal, error: wError } = await adminSupabase
      .from('withdrawals')
      .insert({
        user_id: authUser.id,
        amount,
        bank_account_number,
        bank_code,
        account_name,
        recipient_code,
        status: 'processing',
      })
      .select()
      .single();

    if (wError) return serverError(wError.message);

    // Initiate Paystack transfer
    try {
      const transfer = await initiateTransfer({
        source: 'balance',
        amount: Math.round(amount * 100), // kobo
        recipient: recipient_code,
        reason: `EduTech withdrawal`,
        reference,
      });

      await adminSupabase
        .from('withdrawals')
        .update({ paystack_transfer_code: transfer.transfer_code })
        .eq('id', withdrawal.id);

      return created(
        { ...withdrawal, paystack_transfer_code: transfer.transfer_code },
        'Withdrawal initiated',
      );
    } catch (err) {
      // Rollback: mark withdrawal failed, reverse pending debit
      await adminSupabase
        .from('withdrawals')
        .update({ status: 'failed', failure_reason: 'Paystack transfer initiation failed' })
        .eq('id', withdrawal.id);

      await adminSupabase
        .from('wallet_ledger')
        .update({ status: 'failed' })
        .eq('reference_id', reference);

      const msg = err instanceof Error ? err.message : 'Transfer failed';
      return serverError(msg);
    }
  } catch {
    return serverError();
  }
}
