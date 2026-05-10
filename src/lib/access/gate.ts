import { createAdminClient } from '@/lib/supabase/admin';
import type { User } from '@/types/database';

export interface UnlockedFaculty {
  university_id: string | null;
  faculty_id: string;
  school: string | null;
  faculty: string | null;
  plan: 'monthly' | 'quarterly' | 'yearly';
  starts_at: string | null;
  ends_at: string | null;
}

export interface AccessSummary {
  isAdmin: boolean;
  unlocked: UnlockedFaculty[];
  // True if the user has full read access (admin) — paywall doesn't apply.
  hasFullAccess: boolean;
}

export async function loadAccessSummary(profile: User): Promise<AccessSummary> {
  const isAdmin = profile.role === 'admin';
  if (isAdmin) {
    return { isAdmin: true, unlocked: [], hasFullAccess: true };
  }
  const admin = createAdminClient();
  const { data } = await admin.rpc('list_unlocked_faculties', { p_user_id: profile.id });
  const unlocked = (Array.isArray(data) ? data : []).map((r) => ({
    university_id: r.university_id ?? null,
    faculty_id: r.faculty_id,
    school: r.school ?? null,
    faculty: r.faculty ?? null,
    plan: r.plan,
    starts_at: r.starts_at ?? null,
    ends_at: r.ends_at ?? null,
  }));
  return { isAdmin: false, unlocked, hasFullAccess: false };
}

// Returns true when this faculty is unlocked for this user.
export function canRead(access: AccessSummary, faculty_id: string | null): boolean {
  if (access.hasFullAccess) return true;
  if (!faculty_id) return false;
  return access.unlocked.some((u) => u.faculty_id === faculty_id);
}

export function unlockedFacultyIds(access: AccessSummary): string[] {
  return access.unlocked.map((u) => u.faculty_id);
}
