import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ok, serverError } from '@/lib/utils/response';

// Public read — used by registration + course creation dropdowns.
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('universities')
      .select('id, name, short_name')
      .order('name');
    if (error) return serverError(error.message);
    return ok(data ?? []);
  } catch {
    return serverError();
  }
}
