import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashQuestionText } from '@/lib/utils/hash';
import { requireRole } from '@/lib/utils/auth';
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from '@/lib/utils/response';
import { friendlyZodError } from '@/lib/utils/friendly-errors';
import type { Database } from '@/types/supabase';

type ExtractionUpdate = Database['public']['Tables']['upload_extractions']['Update'];

const schema = z.object({
  question_text: z.string().min(1).optional(),
  question_type: z.enum(['mcq', 'theory']).optional(),
  options: z.record(z.string(), z.string()).nullable().optional(),
  correct_answer: z.string().nullable().optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  excluded: z.boolean().optional(),
  image_urls: z.array(z.string().url()).max(8).optional(),
  part_label: z.string().max(8).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; extractionId: string }> },
) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { id, extractionId } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

    const supabase = await createClient();
    const { data: upload } = await supabase
      .from('uploads')
      .select('id, user_id')
      .eq('id', id)
      .single();
    if (!upload) return notFound('Upload not found');
    if (profile.role !== 'admin' && upload.user_id !== profile.id) return forbidden();

    const update: ExtractionUpdate = { ...parsed.data };
    // Recompute hash if the text changed.
    if (typeof parsed.data.question_text === 'string') {
      update.content_hash = hashQuestionText(parsed.data.question_text);
    }

    const adminSupabase = createAdminClient();
    const { data, error: dbError } = await adminSupabase
      .from('upload_extractions')
      .update(update)
      .eq('id', extractionId)
      .eq('upload_id', id)
      .select()
      .single();

    if (dbError) return serverError(dbError.message);
    if (!data) return notFound('Extraction not found');
    return ok(data);
  } catch {
    return serverError();
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; extractionId: string }> },
) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { id, extractionId } = await params;
    const supabase = await createClient();
    const { data: upload } = await supabase
      .from('uploads')
      .select('id, user_id')
      .eq('id', id)
      .single();
    if (!upload) return notFound('Upload not found');
    if (profile.role !== 'admin' && upload.user_id !== profile.id) return forbidden();

    const adminSupabase = createAdminClient();
    await adminSupabase
      .from('upload_extractions')
      .delete()
      .eq('id', extractionId)
      .eq('upload_id', id);
    return ok(null, 'Extraction removed');
  } catch {
    return serverError();
  }
}
