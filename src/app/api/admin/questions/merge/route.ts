import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/utils/auth';
import { mergeQuestions } from '@/lib/dedup/similarity';
import { ok, badRequest, unauthorized, serverError } from '@/lib/utils/response';

const schema = z.object({
  keep_id: z.string().uuid(),
  remove_id: z.string().uuid(),
});

// POST /api/admin/questions/merge
export async function POST(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized();

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    if (parsed.data.keep_id === parsed.data.remove_id)
      return badRequest('keep_id and remove_id must be different');

    await mergeQuestions(parsed.data.keep_id, parsed.data.remove_id);
    return ok(null, 'Questions merged successfully');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Merge failed';
    return serverError(message);
  }
}
