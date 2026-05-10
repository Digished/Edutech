import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/utils/auth';
import { ok, badRequest, unauthorized, serverError } from '@/lib/utils/response';
import { friendlyZodError } from '@/lib/utils/friendly-errors';

const schema = z.object({
  full_name: z.string().min(1).optional(),
  school: z.string().optional(),
  department: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const { authUser, error } = await getAuthUser();
    if (error || !authUser) return unauthorized();

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

    const supabase = await createClient();
    const { data, error: updateError } = await supabase
      .from('users')
      .update(parsed.data)
      .eq('id', authUser.id)
      .select()
      .single();

    if (updateError) return serverError(updateError.message);
    return ok(data);
  } catch {
    return serverError();
  }
}
