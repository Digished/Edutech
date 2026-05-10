import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { created, badRequest, unauthorized, serverError, paginated } from '@/lib/utils/response';
import { friendlyZodError } from '@/lib/utils/friendly-errors';
import { getPagination } from '@/lib/utils/pagination';

// Accept either FK ids (preferred) or denormalised text. The route resolves
// the missing half before insert.
const schema = z.object({
  university_id: z.string().uuid().optional(),
  faculty_id:    z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  school:     z.string().min(1).optional(),
  faculty:    z.string().min(1).optional(),
  department: z.string().min(1).optional(),
  name:       z.string().min(1),
  code:       z.string().optional().nullable(),
});

// GET /api/courses?university_id=&faculty_id=&department_id=&school=&department=&page=&limit=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const universityId = searchParams.get('university_id');
    const facultyId    = searchParams.get('faculty_id');
    const departmentId = searchParams.get('department_id');
    const school     = searchParams.get('school');
    const department = searchParams.get('department');
    const page  = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const { from, to } = getPagination(page, limit);

    const supabase = await createClient();
    let query = supabase.from('courses').select('*', { count: 'exact' });

    if (universityId) query = query.eq('university_id', universityId);
    if (facultyId)    query = query.eq('faculty_id', facultyId);
    if (departmentId) query = query.eq('department_id', departmentId);
    if (school)       query = query.ilike('school', `%${school}%`);
    if (department)   query = query.ilike('department', `%${department}%`);

    const { data, count, error } = await query
      .order('school', { ascending: true })
      .order('name', { ascending: true })
      .range(from, to);

    if (error) return serverError(error.message);
    return paginated(data ?? [], count ?? 0, page, limit);
  } catch {
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

    // Resolve FK ids and denormalised TEXT to a fully-populated row.
    const admin = createAdminClient();

    let { university_id, faculty_id, department_id } = parsed.data;
    let { school, faculty, department } = parsed.data;

    if (department_id) {
      const { data: dept } = await admin
        .from('departments')
        .select('id, name, faculty_id, faculties(id, name, university_id, universities(id, name))')
        .eq('id', department_id)
        .single();
      if (!dept) return badRequest('Department not found');
      type DeptRow = {
        id: string;
        name: string;
        faculty_id: string;
        faculties: {
          id: string;
          name: string;
          university_id: string;
          universities: { id: string; name: string };
        } | null;
      };
      const d = dept as unknown as DeptRow;
      faculty_id = d.faculty_id;
      university_id = d.faculties?.university_id;
      school = d.faculties?.universities?.name ?? school;
      faculty = d.faculties?.name ?? faculty;
      department = d.name;
    } else if (school && faculty && department) {
      // Resolve from text (used by inline course creation in upload form).
      const { data: uni } = await admin
        .from('universities').select('id').eq('name', school).single();
      if (!uni) return badRequest('University not found');
      const { data: fac } = await admin
        .from('faculties').select('id').eq('university_id', uni.id).eq('name', faculty).single();
      if (!fac) return badRequest('Faculty not found');
      const { data: dept } = await admin
        .from('departments').select('id').eq('faculty_id', fac.id).eq('name', department).single();
      if (!dept) return badRequest('Department not found');
      university_id = uni.id;
      faculty_id    = fac.id;
      department_id = dept.id;
    } else {
      return badRequest('Provide department_id, or school + faculty + department');
    }

    if (!university_id || !faculty_id || !department_id || !school || !faculty || !department) {
      return badRequest('Could not resolve full course taxonomy');
    }

    const supabase = await createClient();
    const { data, error: dbError } = await supabase
      .from('courses')
      .insert({
        university_id,
        faculty_id,
        department_id,
        school,
        faculty,
        department,
        name: parsed.data.name,
        code: parsed.data.code ?? null,
        created_by: profile.id,
      })
      .select()
      .single();

    if (dbError) {
      if (dbError.code === '23505') return badRequest('Course with this code already exists in this department');
      return serverError(dbError.message);
    }

    return created(data);
  } catch {
    return serverError();
  }
}
