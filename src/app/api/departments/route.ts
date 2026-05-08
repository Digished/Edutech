import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ok, serverError } from '@/lib/utils/response';

// Public read — used by dropdowns. Filter by ?university_id= or ?university=<name>.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const universityId = searchParams.get('university_id');
    const universityName = searchParams.get('university');

    const supabase = await createClient();
    let query = supabase.from('departments').select('id, name, university_id, universities(name)');

    if (universityId) {
      query = query.eq('university_id', universityId);
    } else if (universityName) {
      const { data: uni } = await supabase
        .from('universities')
        .select('id')
        .eq('name', universityName)
        .single();
      if (!uni) return ok([]);
      query = query.eq('university_id', uni.id);
    }

    const { data, error } = await query.order('name');
    if (error) return serverError(error.message);
    return ok(data ?? []);
  } catch {
    return serverError();
  }
}
