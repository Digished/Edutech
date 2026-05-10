import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, badRequest, conflict, serverError } from '@/lib/utils/response';
import { friendlyZodError } from '@/lib/utils/friendly-errors';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1).optional(),
  school: z.string().optional(),
  department: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

    const { email, password, full_name, school, department } = parsed.data;

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      if (authError.message.includes('already registered'))
        return conflict('Email already registered');
      return badRequest(authError.message);
    }

    if (!authData.user) return serverError('Could not create user');

    const adminSupabase = createAdminClient();
    const { data: profile, error: profileError } = await adminSupabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        full_name: full_name ?? null,
        school: school ?? null,
        department: department ?? null,
        role: 'student',
      })
      .select()
      .single();

    if (profileError) return serverError(profileError.message);

    return ok(
      { user: profile, session: authData.session },
      'Registration successful. Please verify your email.',
    );
  } catch {
    return serverError();
  }
}
