import { createClient } from '@/lib/supabase/server';
import { ok, unauthorized, notFound, serverError } from '@/lib/utils/response';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return unauthorized();

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) return notFound('User profile not found');

    return ok(profile);
  } catch {
    return serverError();
  }
}
