import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { created, badRequest, unauthorized, serverError, paginated } from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// GET /api/uploads — own uploads
export async function GET(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized();

    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const { from, to } = getPagination(page, limit);

    const supabase = await createClient();
    let query = supabase
      .from('uploads')
      .select('*, courses(name, school, department)', { count: 'exact' });

    if (profile.role !== 'admin') query = query.eq('user_id', profile.id);

    const { data, count, error: dbError } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (dbError) return serverError(dbError.message);
    return paginated(data ?? [], count ?? 0, page, limit);
  } catch {
    return serverError();
  }
}

// POST /api/uploads — multipart form upload
export async function POST(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const course_id = formData.get('course_id') as string | null;
    const levelRaw = formData.get('level');
    const semesterRaw = formData.get('semester');

    if (!file) return badRequest('No file provided');
    if (!course_id) return badRequest('course_id is required');

    const validationSchema = z.string().uuid();
    if (!validationSchema.safeParse(course_id).success)
      return badRequest('Invalid course_id');

    if (file.size > MAX_FILE_SIZE) return badRequest('File size exceeds 20MB limit');

    // Level (100-600) and semester (1/2/3) are required and propagate to every
    // extracted question on confirm.
    const level = levelRaw ? parseInt(String(levelRaw)) : NaN;
    const semester = semesterRaw ? parseInt(String(semesterRaw)) : NaN;
    if (![100, 200, 300, 400, 500, 600].includes(level)) {
      return badRequest('Pick a level (100-600)');
    }
    if (![1, 2, 3].includes(semester)) {
      return badRequest('Pick a semester (1, 2 or 3)');
    }

    const mimeToType: Record<string, 'pdf' | 'image'> = {
      'application/pdf': 'pdf',
      'image/jpeg': 'image',
      'image/png': 'image',
      'image/webp': 'image',
    };

    const file_type = mimeToType[file.type];
    if (!file_type) return badRequest('Unsupported file type. Use PDF or image (JPEG/PNG/WebP)');

    const ext = file.name.split('.').pop();
    const storagePath = `${profile.id}/${Date.now()}.${ext}`;

    const adminSupabase = createAdminClient();

    async function uploadOnce() {
      return adminSupabase.storage.from('exam-uploads').upload(storagePath, file!, {
        contentType: file!.type,
        upsert: false,
      });
    }

    let { error: storageError } = await uploadOnce();

    // Auto-provision the bucket if it doesn't exist yet, then retry once.
    if (storageError && /bucket not found/i.test(storageError.message)) {
      const { error: createErr } = await adminSupabase.storage.createBucket('exam-uploads', {
        public: false,
        fileSizeLimit: MAX_FILE_SIZE,
      });
      if (createErr && !/already exists/i.test(createErr.message)) {
        return serverError(`Storage setup error: ${createErr.message}`);
      }
      ({ error: storageError } = await uploadOnce());
    }

    if (storageError) return serverError(`Storage error: ${storageError.message}`);

    const { data: upload, error: dbError } = await adminSupabase
      .from('uploads')
      .insert({
        user_id: profile.id,
        course_id,
        level,
        semester,
        file_url: storagePath,
        file_type,
        original_name: file.name,
        file_size: file.size,
        processed: false,
      })
      .select()
      .single();

    if (dbError) return serverError(dbError.message);

    return created(upload, 'File uploaded. Call /api/uploads/[id]/process to start extraction.');
  } catch {
    return serverError();
  }
}
