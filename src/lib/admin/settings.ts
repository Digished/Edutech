import { createAdminClient } from '@/lib/supabase/admin';

export const DEFAULT_REWARD_PER_100 = 1000;
export const REWARD_BUCKET_SIZE = 100;

// Read the global ₦/100-questions reward. Falls back to the default if the row
// or the database is somehow missing it.
export async function getRewardPer100(): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('admin_settings')
      .select('value_num')
      .eq('key', 'reward_per_100_questions')
      .single();
    const val = data?.value_num;
    if (typeof val === 'number' && val > 0) return val;
  } catch {
    // ignore — defaults apply
  }
  return DEFAULT_REWARD_PER_100;
}

export async function setRewardPer100(value: number, updatedBy: string | null): Promise<number> {
  const admin = createAdminClient();
  await admin
    .from('admin_settings')
    .upsert(
      {
        key: 'reward_per_100_questions',
        value_num: value,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      },
      { onConflict: 'key' },
    );
  return value;
}
