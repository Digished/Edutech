import { createAdminClient } from '@/lib/supabase/admin';
import type { User } from '@/types/database';

export interface UnlockedPair {
  university_id: string | null;
  faculty_id: string | null;
  department_id: string | null;
  school: string;
  faculty: string | null;
  department: string;
}

export interface AccessSummary {
  isAdmin: boolean;
  unlocked: UnlockedPair[];
  // True if the user has full read access (admin) — paywall doesn't apply.
  hasFullAccess: boolean;
}

export async function loadAccessSummary(profile: User): Promise<AccessSummary> {
  const isAdmin = profile.role === 'admin';
  if (isAdmin) {
    return { isAdmin: true, unlocked: [], hasFullAccess: true };
  }
  const admin = createAdminClient();
  const { data } = await admin.rpc('list_unlocked_departments', { p_user_id: profile.id });
  const unlocked = (Array.isArray(data) ? data : []).map((r) => ({
    university_id: r.university_id ?? null,
    faculty_id: r.faculty_id ?? null,
    department_id: r.department_id ?? null,
    school: r.school,
    faculty: r.faculty ?? null,
    department: r.department,
  }));
  return { isAdmin: false, unlocked, hasFullAccess: false };
}

// Returns true when (school, department) is unlocked for this user.
export function canRead(
  access: AccessSummary,
  school: string | null,
  department: string | null,
): boolean {
  if (access.hasFullAccess) return true;
  if (!school || !department) return false;
  return access.unlocked.some((u) => u.school === school && u.department === department);
}
