import { createClient } from '@/lib/supabase/server';
import { User, UserRole } from '@/types/database';

export async function getAuthUser(): Promise<{
  authUser: { id: string; email: string } | null;
  profile: User | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { authUser: null, profile: null, error: 'Not authenticated' };

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return {
    authUser: { id: user.id, email: user.email! },
    profile: profile as User | null,
    error: null,
  };
}

export async function requireRole(
  allowedRoles: UserRole[],
): Promise<{ profile: User; error: null } | { profile: null; error: string }> {
  const { profile, error } = await getAuthUser();

  if (error || !profile) return { profile: null, error: error || 'Not authenticated' };
  if (profile.is_banned) return { profile: null, error: 'Account suspended' };
  if (!allowedRoles.includes(profile.role))
    return { profile: null, error: 'Insufficient permissions' };

  return { profile, error: null };
}
