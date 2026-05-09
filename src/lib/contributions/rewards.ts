// ============================================================
// Contribution Reward Engine
// Calculates per-user payouts from the revenue pool.
// High-yield tags add +HIGH_YIELD_BONUS_PER_TAG to a contributor's
// effective weight on each question they contributed to.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { generateReference } from '@/lib/utils/hash';
import { HIGH_YIELD_BONUS_PER_TAG } from '@/types/database';

export interface ContributorShare {
  user_id: string;
  weighted_score: number;
  views_score: number;
  total_score: number;
  payout_amount: number;
}

const WEIGHTS: Record<string, number> = {
  upload: 1.0,
  extraction: 1.0,
  edit: 0.5,
  correction: 0.7,
};

export async function calculateContributorShares(
  poolId: string,
): Promise<ContributorShare[]> {
  const supabase = createAdminClient();

  const { data: pool } = await supabase
    .from('revenue_pool')
    .select('*')
    .eq('id', poolId)
    .single();

  if (!pool || pool.distributed) throw new Error('Pool not found or already distributed');

  const { data: contributions } = await supabase
    .from('question_contributions')
    .select(`
      user_id,
      contribution_type,
      contribution_weight,
      questions!inner(
        id,
        status,
        question_analytics(views_count)
      )
    `)
    .eq('questions.status', 'approved')
    .eq('questions.is_deleted', false);

  if (!contributions?.length) return [];

  // Live count of high-yield tags per question.
  const questionIds = Array.from(
    new Set(
      contributions
        .map((c) => (c.questions as unknown as { id: string })?.id)
        .filter(Boolean),
    ),
  );

  const tagCountByQuestion = new Map<string, number>();
  if (questionIds.length) {
    const { data: tags } = await supabase
      .from('high_yield_tags')
      .select('question_id')
      .in('question_id', questionIds);
    for (const t of tags ?? []) {
      tagCountByQuestion.set(t.question_id, (tagCountByQuestion.get(t.question_id) ?? 0) + 1);
    }
  }

  const userScores = new Map<string, { weighted: number; views: number }>();

  for (const c of contributions) {
    const typeWeight = WEIGHTS[c.contribution_type] ?? 1.0;

    const question = c.questions as unknown as {
      id: string;
      question_analytics: { views_count: number }[];
    };
    const tagCount = tagCountByQuestion.get(question.id) ?? 0;
    const tagBonus = tagCount * HIGH_YIELD_BONUS_PER_TAG;

    // Base weight ≤ 1.0 from the contribution row, scaled by type, plus the
    // live high-yield bonus. Effective weight scales linearly with tags.
    const effectiveWeight = c.contribution_weight * typeWeight * (1 + tagBonus);

    const viewsCount = question?.question_analytics?.[0]?.views_count ?? 0;

    const current = userScores.get(c.user_id) ?? { weighted: 0, views: 0 };
    userScores.set(c.user_id, {
      weighted: current.weighted + effectiveWeight,
      views: current.views + viewsCount,
    });
  }

  const totalWeighted = [...userScores.values()].reduce((s, v) => s + v.weighted, 0);
  const totalViews = [...userScores.values()].reduce((s, v) => s + v.views, 0);

  const poolAmount = pool.payout_pool_amount as number;

  const shares: ContributorShare[] = [];

  for (const [user_id, scores] of userScores.entries()) {
    const weightedFraction = totalWeighted > 0 ? scores.weighted / totalWeighted : 0;
    const viewsFraction = totalViews > 0 ? scores.views / totalViews : 0;
    const totalScore = weightedFraction * 0.6 + viewsFraction * 0.4;
    const payout_amount = parseFloat((totalScore * poolAmount).toFixed(2));

    shares.push({
      user_id,
      weighted_score: scores.weighted,
      views_score: scores.views,
      total_score: totalScore,
      payout_amount,
    });
  }

  return shares.filter((s) => s.payout_amount > 0);
}

export async function distributeRevenuePool(poolId: string): Promise<number> {
  const supabase = createAdminClient();
  const shares = await calculateContributorShares(poolId);

  if (!shares.length) return 0;

  const ledgerEntries = shares.map((share) => ({
    user_id: share.user_id,
    amount: share.payout_amount,
    currency: 'NGN',
    type: 'credit' as const,
    status: 'successful' as const,
    reason: 'contribution_reward' as const,
    reference_id: generateReference('RWD'),
    metadata: {
      pool_id: poolId,
      weighted_score: share.weighted_score,
      views_score: share.views_score,
    },
  }));

  await supabase.from('wallet_ledger').insert(ledgerEntries);

  await supabase
    .from('revenue_pool')
    .update({ distributed: true, distributed_at: new Date().toISOString() })
    .eq('id', poolId);

  const notifications = shares.map((share) => ({
    user_id: share.user_id,
    title: 'Earnings Credited',
    body: `₦${share.payout_amount.toFixed(2)} has been credited to your wallet from this month's revenue pool.`,
    type: 'reward',
    metadata: { pool_id: poolId, amount: share.payout_amount },
  }));

  await supabase.from('notifications').insert(notifications);

  return shares.length;
}
