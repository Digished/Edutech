import { ok, serverError } from '@/lib/utils/response';
import { getRewardPer100, REWARD_BUCKET_SIZE } from '@/lib/admin/settings';

// GET /api/settings — public, read-only. Used by contributor-facing UI to
// show the current reward amount.
export async function GET() {
  try {
    const reward = await getRewardPer100();
    return ok({
      reward_per_100_questions: reward,
      reward_bucket_size: REWARD_BUCKET_SIZE,
    });
  } catch {
    return serverError();
  }
}
