import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { created, badRequest, unauthorized, serverError } from '@/lib/utils/response';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// POST /api/uploads/image — multipart, single file. Stores in the public
// `question-images` bucket and returns the public URL so callers can attach
// it to a question or extraction.
export async function POST(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return badRequest('No file provided');
    if (file.size > MAX_IMAGE_BYTES) return badRequest('Image is larger than 5MB');
    if (!ALLOWED.has(file.type)) return badRequest('Use JPEG, PNG, WebP or GIF');

    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase();
    const path = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const admin = createAdminClient();

    async function uploadOnce() {
      return admin.storage.from('question-images').upload(path, file!, {
        contentType: file!.type,
        upsert: false,
      });
    }

    let { error: uploadErr } = await uploadOnce();

    if (uploadErr && /bucket not found/i.test(uploadErr.message)) {
      const { error: createErr } = await admin.storage.createBucket('question-images', {
        public: true,
        fileSizeLimit: MAX_IMAGE_BYTES,
      });
      if (createErr && !/already exists/i.test(createErr.message)) {
        return serverError(`Storage setup error: ${createErr.message}`);
      }
      ({ error: uploadErr } = await uploadOnce());
    }

    if (uploadErr) return serverError(`Upload failed: ${uploadErr.message}`);

    const { data: pub } = admin.storage.from('question-images').getPublicUrl(path);
    return created({ url: pub.publicUrl, path }, 'Image uploaded');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Image upload failed';
    return serverError(msg);
  }
}
