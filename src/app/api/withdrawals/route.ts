import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/utils/auth';
import { created, badRequest, unauthorized, serverError, paginated } from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';
import {
  createTransferRecipient,
  initiateTransfer,
  verifyAccountNumber,
} from '@/lib/paystack/transfers';
import { generateReference } from '@/lib/utils/hash';
import { friendlyZodError } from '@/lib/utils/friendly-errors';

const MIN_WITHDRAWAL = 1000; // ₦1,000 minimum

// Accept either an explicit bank+account combination or a saved payout_method_id.
// Both `account_number` and `bank_account_number` are accepted for compatibility.
const schema = z
  .object({
    amount: z.number().min(MIN_WITHDRAWAL, `The minimum withdrawal is ₦${MIN_WITHDRAWAL.toLocaleString()}.`),
    payout_method_id: z.string().uuid().optional(),
    bank_account_number: z.string().length(10).optional(),
    account_number: z.string().length(10).optional(),
    bank_code: z.string().min(3).optional(),
    bank_name: z.string().optional(),
    save_method: z.boolean().optional(),
  })
  .refine(
    (v) => v.payout_method_id || ((v.bank_account_number || v.account_number) && v.bank_code),
    { message: 'Choose a saved bank account or enter a new one.' },
  );

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
    const { authUser, profile, error } = await getAuthUser();
    if (error || !authUser || !profile) return unauthorized();

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

    const { amount, payout_method_id, save_method, bank_name } = parsed.data;
    const adminSupabase = createAdminClient();

    let bank_code = parsed.data.bank_code ?? '';
    let bank_account_number = parsed.data.bank_account_number ?? parsed.data.account_number ?? '';
    let account_name: string | null = null;
    let recipient_code: string | null = null;
    let savedMethodId: string | null = null;

    if (payout_method_id) {
      const { data: method } = await adminSupabase
        .from('payout_methods')
        .select('*')
        .eq('id', payout_method_id)
        .eq('user_id', authUser.id)
        .single();
      if (!method) return badRequest('We couldn’t find that saved bank account.');
      bank_code = method.bank_code;
      bank_account_number = method.account_number;
      account_name = method.account_name;
      recipient_code = method.recipient_code;
      savedMethodId = method.id;
    }

    // Mint any newly-earned reward credits, then compute the balance off the ledger.
    await adminSupabase.rpc('mint_contributor_rewards', { p_user_id: authUser.id });

    const { data: rows } = await adminSupabase
      .from('wallet_ledger')
      .select('amount, type, status')
      .eq('user_id', authUser.id)
      .eq('status', 'successful');
    let balance = 0;
    for (const r of rows ?? []) {
      const a = Number(r.amount) || 0;
      if (r.type === 'credit') balance += a; else balance -= a;
    }
    if (balance < amount) {
      return badRequest(
        `Not enough in your wallet. You have ₦${balance.toLocaleString('en-NG')}.`,
      );
    }

    // Verify bank account via Paystack if we don't already have a verified name.
    if (!account_name) {
      try {
        const verified = await verifyAccountNumber(bank_account_number, bank_code);
        account_name = verified.account_name;
      } catch {
        return badRequest('We couldn’t verify that bank account. Please check the bank and account number.');
      }
    }

    // Create Paystack transfer recipient if we don't already have one.
    if (!recipient_code) {
      try {
        const recipient = await createTransferRecipient({
          type: 'nuban',
          name: account_name,
          account_number: bank_account_number,
          bank_code,
          currency: 'NGN',
        });
        recipient_code = recipient.recipient_code;
      } catch {
        return serverError('We couldn’t set up the bank transfer. Please try again.');
      }
    }

    // Persist the payout method if asked (default for new ones).
    if (!savedMethodId && save_method !== false) {
      const { data: persisted } = await adminSupabase
        .from('payout_methods')
        .upsert(
          {
            user_id: authUser.id,
            bank_code,
            bank_name: bank_name ?? null,
            account_number: bank_account_number,
            account_name,
            recipient_code,
            is_default: true,
          },
          { onConflict: 'user_id,bank_code,account_number' },
        )
        .select('id')
        .single();
      savedMethodId = persisted?.id ?? null;
      if (savedMethodId) {
        await adminSupabase
          .from('payout_methods')
          .update({ is_default: false })
          .eq('user_id', authUser.id)
          .neq('id', savedMethodId);
      }
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
        reason: `Examspace withdrawal`,
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
    } catch {
      // Rollback: mark withdrawal failed, reverse pending debit
      await adminSupabase
        .from('withdrawals')
        .update({ status: 'failed', failure_reason: 'Paystack transfer initiation failed' })
        .eq('id', withdrawal.id);

      await adminSupabase
        .from('wallet_ledger')
        .update({ status: 'failed' })
        .eq('reference_id', reference);

      return serverError('We couldn’t start the transfer. Your wallet wasn’t charged.');
    }
  } catch {
    return serverError();
  }
}
