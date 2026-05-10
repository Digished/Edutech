import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/utils/auth';
import { ok, unauthorized, serverError } from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';
import { getRewardPer100, REWARD_BUCKET_SIZE } from '@/lib/admin/settings';

// GET /api/wallet — balance + ledger. Lazily mints any owed reward credits
// before computing the balance, so the wallet is always up to date.
export async function GET(req: NextRequest) {
  try {
    const { authUser, error } = await getAuthUser();
    if (error || !authUser) return unauthorized();

    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const { from, to } = getPagination(page, limit);

    const admin = createAdminClient();

    // Mint any owed reward credits before reading.
    await admin.rpc('mint_contributor_rewards', { p_user_id: authUser.id });

    const [{ data: ledger, count, error: ledgerError }, { data: approvedRow }, rate] = await Promise.all([
      admin
        .from('wallet_ledger')
        .select('*', { count: 'exact' })
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .range(from, to),
      admin.rpc('contributor_question_count', { p_user_id: authUser.id }),
      getRewardPer100(),
    ]);

    if (ledgerError) {
      return serverError(ledgerError.message);
    }

    // Sum successful credits/debits across the whole ledger (not just this page).
    const { data: totals } = await admin
      .from('wallet_ledger')
      .select('amount, type, status')
      .eq('user_id', authUser.id)
      .eq('status', 'successful');

    let balance = 0;
    for (const r of totals ?? []) {
      const amt = Number(r.amount) || 0;
      if (r.type === 'credit') balance += amt;
      else balance -= amt;
    }

    const approved = typeof approvedRow === 'number' ? approvedRow : 0;
    const buckets_earned = Math.floor(approved / REWARD_BUCKET_SIZE);
    const next_bucket_progress = approved % REWARD_BUCKET_SIZE;

    return ok({
      balance,
      currency: 'NGN',
      reward_per_100_questions: rate,
      reward_bucket_size: REWARD_BUCKET_SIZE,
      approved_questions: approved,
      buckets_earned,
      next_bucket_progress,
      ledger: {
        data: ledger ?? [],
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : 'unknown error');
  }
}
