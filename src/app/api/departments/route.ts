import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ok, serverError } from '@/lib/utils/response';

// Public read — used by cascading dropdowns.
//   * ?faculty_id=<uuid>      — direct faculty filter
//   * ?university_id=<uuid>   — all departments under that university
//   * ?university=<name>      — same, looked up by name (legacy)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const facultyId = searchParams.get('faculty_id');
    const universityId = searchParams.get('university_id');
    const universityName = searchParams.get('university');

    const supabase = await createClient();
    let query = supabase
      .from('departments')
      .select('id, name, faculty_id, faculties(id, name, university_id, universities(name))');

    if (facultyId) {
      query = query.eq('faculty_id', facultyId);
    } else if (universityId || universityName) {
      let uniId = universityId;
      if (!uniId && universityName) {
        const { data: uni } = await supabase
          .from('universities')
          .select('id')
          .eq('name', universityName)
          .single();
        if (!uni) return ok([]);
        uniId = uni.id;
      }
      const { data: facultyRows } = await supabase
        .from('faculties')
        .select('id')
        .eq('university_id', uniId!);
      const facultyIds = (facultyRows ?? []).map((f) => f.id);
      if (!facultyIds.length) return ok([]);
      query = query.in('faculty_id', facultyIds);
    }

    const { data, error } = await query.order('name');
    if (error) return serverError(error.message);
    return ok(data ?? []);
  } catch {
    return serverError();
  }
}
