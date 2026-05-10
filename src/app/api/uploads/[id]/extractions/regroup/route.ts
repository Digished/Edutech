import { NextRequest } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/utils/auth';
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from '@/lib/utils/response';
import { friendlyZodError } from '@/lib/utils/friendly-errors';

// Atomic regrouping operations on extracted drafts of a single upload.
// Lets a contributor convert standalone questions into sub-parts of a shared
// stem (and back) before publishing.
const groupSchema = z.object({
  action: z.literal('group'),
  ids: z.array(z.string().uuid()).min(1).max(20),
  stem: z.string().min(1),
  group_key: z.string().min(1).optional(),
  part_labels: z.array(z.string().max(8)).optional(),
});

const detachSchema = z.object({
  action: z.literal('detach'),
  id: z.string().uuid(),
});

const updateStemSchema = z.object({
  action: z.literal('update_stem'),
  group_key: z.string().min(1),
  stem: z.string().min(1),
});

const schema = z.discriminatedUnion('action', [groupSchema, detachSchema, updateStemSchema]);

const DEFAULT_LABELS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

    const supabase = await createClient();
    const { data: upload } = await supabase
      .from('uploads')
      .select('id, user_id, needs_review, processing_stage')
      .eq('id', id)
      .single();
    if (!upload) return notFound('Upload not found');
    if (profile.role !== 'admin' && upload.user_id !== profile.id) return forbidden();
    if (upload.processing_stage === 'Published' || upload.needs_review === false) {
      return badRequest('This batch has already been submitted; regrouping is no longer allowed');
    }

    const adminSupabase = createAdminClient();

    if (parsed.data.action === 'group') {
      const { ids, stem, part_labels } = parsed.data;
      const groupKey = parsed.data.group_key ?? randomUUID().slice(0, 8);

      // Update each row in document order.
      for (let i = 0; i < ids.length; i++) {
        const label = part_labels?.[i]?.trim() || DEFAULT_LABELS[i] || String(i + 1);
        const { error: upErr } = await adminSupabase
          .from('upload_extractions')
          .update({
            group_key: groupKey,
            stem,
            part_label: label,
            part_position: i + 1,
          })
          .eq('id', ids[i])
          .eq('upload_id', id);
        if (upErr) return serverError(upErr.message);
      }
      return ok({ group_key: groupKey, count: ids.length }, `Grouped ${ids.length} parts under one stem`);
    }

    if (parsed.data.action === 'detach') {
      const { error: upErr } = await adminSupabase
        .from('upload_extractions')
        .update({
          group_key: null,
          stem: null,
          part_label: null,
          part_position: null,
        })
        .eq('id', parsed.data.id)
        .eq('upload_id', id);
      if (upErr) return serverError(upErr.message);
      return ok(null, 'Detached from group');
    }

    if (parsed.data.action === 'update_stem') {
      const { error: upErr } = await adminSupabase
        .from('upload_extractions')
        .update({ stem: parsed.data.stem })
        .eq('upload_id', id)
        .eq('group_key', parsed.data.group_key);
      if (upErr) return serverError(upErr.message);
      return ok(null, 'Stem updated');
    }

    return badRequest('Unknown action');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Regroup failed';
    return serverError(message);
  }
}
