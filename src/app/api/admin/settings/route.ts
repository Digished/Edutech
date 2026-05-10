import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/utils/auth';
import { ok, badRequest, unauthorized, serverError } from '@/lib/utils/response';
import { friendlyZodError } from '@/lib/utils/friendly-errors';
import { getRewardPer100, setRewardPer100, REWARD_BUCKET_SIZE } from '@/lib/admin/settings';

const schema = z.object({
  reward_per_100_questions: z.number().positive().max(10_000_000),
});

// GET /api/admin/settings — admin view of the same numbers.
export async function GET() {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized();
    const reward = await getRewardPer100();
    return ok({ reward_per_100_questions: reward, reward_bucket_size: REWARD_BUCKET_SIZE });
  } catch {
    return serverError();
  }
}

// PUT /api/admin/settings — update the rate.
export async function PUT(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized();

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

    await setRewardPer100(parsed.data.reward_per_100_questions, profile.id);
    return ok({
      reward_per_100_questions: parsed.data.reward_per_100_questions,
      reward_bucket_size: REWARD_BUCKET_SIZE,
    }, 'Settings saved');
  } catch {
    return serverError();
  }
}
