import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/utils/auth';
import { processUpload } from '@/lib/ocr/pipeline';
import { ok, unauthorized, forbidden, notFound, serverError } from '@/lib/utils/response';

// POST /api/uploads/[id]/process — owner or admin can trigger.
// Runs on the long-timeout function (see vercel.json) so OCR can finish.
export async function POST(
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
      .select('id, user_id, processed')
      .eq('id', id)
      .single();

    if (!upload) return notFound('Upload not found');
    if (profile.role !== 'admin' && upload.user_id !== profile.id) return forbidden();
    if (upload.processed) return ok(null, 'Already processed');

    await processUpload(id);
    return ok(null, 'Processing complete');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed';
    return serverError(message);
  }
}
