import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/utils/auth';
import { suggestAnswer } from '@/lib/ocr/answers';
import { ok, badRequest, unauthorized, serverError } from '@/lib/utils/response';
import { friendlyZodError } from '@/lib/utils/friendly-errors';

const schema = z.object({
  question_text: z.string().min(5),
  question_type: z.enum(['mcq', 'theory']).default('mcq'),
  options: z.record(z.string(), z.string()).nullable().optional(),
});

// POST /api/questions/suggest-answer — contributors / admin can ask the AI to
// propose the correct answer for a question they're authoring.
export async function POST(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(friendlyZodError(parsed.error));

    const { question_text, question_type, options } = parsed.data;
    if (question_type === 'mcq' && (!options || Object.keys(options).length < 2)) {
      return badRequest('Add at least two options before suggesting an answer');
    }

    const result = await suggestAnswer(question_text, question_type, options ?? null);
    return ok(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Suggestion failed';
    return serverError(message);
  }
}
