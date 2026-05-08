import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/utils/auth';
import { processUpload } from '@/lib/ocr/pipeline';
import { ok, unauthorized, serverError } from '@/lib/utils/response';

// POST /api/uploads/[id]/process — manually trigger processing (admin/system)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { id } = await params;
    await processUpload(id);
    return ok(null, 'Processing complete');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed';
    return serverError(message);
  }
}
