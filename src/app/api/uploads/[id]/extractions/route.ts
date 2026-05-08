import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/utils/auth';
import { ok, unauthorized, forbidden, notFound, serverError } from '@/lib/utils/response';

// GET /api/uploads/[id]/extractions — list draft extractions for an upload.
// Owner or admin.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { id } = await params;
    const supabase = await createClient();

    const { data: upload } = await supabase
      .from('uploads')
      .select('id, user_id, course_id, processing_stage, processing_error, needs_review')
      .eq('id', id)
      .single();
    if (!upload) return notFound('Upload not found');
    if (profile.role !== 'admin' && upload.user_id !== profile.id) return forbidden();

    const { data: extractions, error: dbError } = await supabase
      .from('upload_extractions')
      .select('*')
      .eq('upload_id', id)
      .order('position', { ascending: true });

    if (dbError) return serverError(dbError.message);
    return ok({ upload, extractions: extractions ?? [] });
  } catch {
    return serverError();
  }
}
