import { NextRequest } from 'next/server';
import { verifyPaystackSignature } from '@/lib/paystack/webhook';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, badRequest, serverError } from '@/lib/utils/response';
import { PaystackWebhookEvent } from '@/types/paystack';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature') ?? '';

    if (!verifyPaystackSignature(rawBody, signature)) {
      return badRequest('Invalid webhook signature');
    }

    const event: PaystackWebhookEvent = JSON.parse(rawBody);
    const supabase = createAdminClient();

    switch (event.event) {
      case 'transfer.success':
        await handleTransferSuccess(supabase, event.data);
        break;

      case 'transfer.failed':
      case 'transfer.reversed':
        await handleTransferFailure(supabase, event.data, event.event);
        break;

      case 'charge.success':
        await handleChargeSuccess(supabase, event.data);
        break;

      default:
        // Unhandled event — acknowledge but do nothing
        break;
    }

    return ok(null, 'Webhook processed');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook processing error';
    console.error('Paystack webhook error:', message);
    return serverError(message);
  }
}

async function handleTransferSuccess(
  supabase: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>,
  data: Record<string, unknown>,
): Promise<void> {
  const transferCode = data.transfer_code as string;
  const reference = data.reference as string;

  if (!transferCode) return;

  await supabase
    .from('withdrawals')
    .update({ status: 'successful' })
    .eq('paystack_transfer_code', transferCode);

  // Mark debit ledger entry as successful
  if (reference) {
    await supabase
      .from('wallet_ledger')
      .update({ status: 'successful' })
      .eq('reference_id', reference)
      .eq('type', 'debit');
  }

  // Notify user
  const { data: withdrawal } = await supabase
    .from('withdrawals')
    .select('user_id, amount')
    .eq('paystack_transfer_code', transferCode)
    .single();

  if (withdrawal) {
    await supabase.from('notifications').insert({
      user_id: withdrawal.user_id,
      title: 'Withdrawal Successful',
      body: `Your withdrawal of ₦${withdrawal.amount} was successful.`,
      type: 'withdrawal',
    });
  }
}

async function handleTransferFailure(
  supabase: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>,
  data: Record<string, unknown>,
  eventType: string,
): Promise<void> {
  const transferCode = data.transfer_code as string;
  const reference = data.reference as string;
  const failureReason = (data.reason as string) ?? eventType;

  if (!transferCode) return;

  const { data: withdrawal } = await supabase
    .from('withdrawals')
    .update({
      status: 'failed',
      failure_reason: failureReason,
    })
    .eq('paystack_transfer_code', transferCode)
    .select('user_id, amount')
    .single();

  // Reverse the debit ledger entry
  if (reference) {
    await supabase
      .from('wallet_ledger')
      .update({ status: 'failed' })
      .eq('reference_id', reference)
      .eq('type', 'debit');
  }

  // Notify user
  if (withdrawal) {
    await supabase.from('notifications').insert({
      user_id: withdrawal.user_id,
      title: 'Withdrawal Failed',
      body: `Your withdrawal of ₦${withdrawal.amount} failed. Reason: ${failureReason}. Your balance has been restored.`,
      type: 'withdrawal',
    });
  }
}

async function handleChargeSuccess(
  supabase: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>,
  data: Record<string, unknown>,
): Promise<void> {
  const reference = data.reference as string;
  const amountKobo = data.amount as number;
  const metadata = data.metadata as Record<string, unknown> | undefined;
  const userId = metadata?.user_id as string | undefined;

  if (!userId || !reference) return;

  const amountNGN = amountKobo / 100;

  // Credit wallet via ledger
  await supabase.from('wallet_ledger').upsert(
    {
      user_id: userId,
      amount: amountNGN,
      currency: 'NGN',
      type: 'credit',
      status: 'successful',
      reason: 'adjustment',
      reference_id: reference,
      metadata: data as import('@/types/supabase').Json,
    },
    { onConflict: 'reference_id', ignoreDuplicates: true },
  );
}
