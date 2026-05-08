import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { ok, badRequest, unauthorized, notFound, serverError } from '@/lib/utils/response';

const schema = z.object({
  status: z.enum(['pending', 'processing', 'successful', 'failed']),
  failure_reason: z.string().max(500).nullable().optional(),
});

// PATCH /api/admin/withdrawals/[id] — admin marks a payout request done /
// failed / processing. Refunds the wallet on failure.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized();

    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const supabase = createAdminClient();
    const { data: existing } = await supabase
      .from('withdrawals')
      .select('id, user_id, amount, status')
      .eq('id', id)
      .single();
    if (!existing) return notFound('Withdrawal not found');

    const { data, error: dbError } = await supabase
      .from('withdrawals')
      .update({
        status: parsed.data.status,
        failure_reason: parsed.data.failure_reason ?? null,
      })
      .eq('id', id)
      .select('*, users(full_name, email)')
      .single();

    if (dbError) return serverError(dbError.message);

    // Refund the user's wallet if the payout failed and we hadn't already.
    if (parsed.data.status === 'failed' && existing.status !== 'failed') {
      await supabase.from('wallet_ledger').insert({
        user_id: existing.user_id,
        amount: existing.amount,
        currency: 'NGN',
        type: 'credit',
        status: 'successful',
        reason: 'refund',
        reference_id: `refund_${id}`,
        metadata: { withdrawal_id: id, reason: parsed.data.failure_reason ?? null },
      });
      await supabase.from('notifications').insert({
        user_id: existing.user_id,
        title: 'Payout failed — refunded',
        body: `Your withdrawal of ₦${Number(existing.amount).toLocaleString()} could not be processed and has been refunded to your wallet.${parsed.data.failure_reason ? ` Reason: ${parsed.data.failure_reason}` : ''}`,
        type: 'withdrawal',
        metadata: { withdrawal_id: id },
      });
    } else if (parsed.data.status === 'successful' && existing.status !== 'successful') {
      await supabase.from('notifications').insert({
        user_id: existing.user_id,
        title: 'Payout sent',
        body: `Your withdrawal of ₦${Number(existing.amount).toLocaleString()} has been sent to your bank.`,
        type: 'withdrawal',
        metadata: { withdrawal_id: id },
      });
    }

    return ok(data, `Marked ${parsed.data.status}`);
  } catch {
    return serverError();
  }
}
