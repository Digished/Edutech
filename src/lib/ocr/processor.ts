// ============================================================
// OCR / Extraction Pipeline
// Uses GPT-4o for both PDFs (Files API) and images (vision).
// Extracts both multiple-choice (MCQ) and theory questions.
// ============================================================

import OpenAI from 'openai';
import { QuestionOptions, QuestionType } from '@/types/database';

export interface ExtractedQuestion {
  question_text: string;
  question_type: QuestionType;
  options: QuestionOptions | null;
  correct_answer: string | null;
  year: number | null;
}

export interface ExtractionResult {
  questions: ExtractedQuestion[];
  error: string | null;
}

const EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting exam questions from Nigerian university past papers.

Two question types may be present and you MUST extract BOTH:
- "mcq" — multiple-choice questions that present options (A, B, C, D, …). Capture the options.
- "theory" — open-ended / essay / explanation / "discuss" / "describe" / "prove" / "calculate" / "show that" / "list and explain" questions that have NO options. Capture the full question prompt including any sub-parts (a), (b), (c).

Return a JSON object of the form:
{ "questions": [ { ... }, { ... } ] }

Each item must have:
- question_text: string (full question, include sub-parts joined with newlines for theory)
- question_type: "mcq" | "theory"
- options: object or null — required for mcq (e.g. {"A":"…","B":"…","C":"…","D":"…"}); MUST be null for theory
- correct_answer: string or null (only if explicitly stated, e.g. "A" or a short answer)
- year: number or null (academic year if visible on the paper)

Rules:
- Do not invent options for theory questions. If there are no lettered options, it is theory.
- Do not skip theory questions — extract every numbered question, including sub-parts.
- Preserve mathematical notation as plain text (e.g. x^2, sqrt(x), integral notation).
- Return ONLY the JSON object — no explanation, no markdown.`;

const MAX_OUTPUT_TOKENS = 8000;
const REQUEST_TIMEOUT_MS = 120_000;

function client(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: REQUEST_TIMEOUT_MS,
  });
}

function parseQuestions(content: string | null | undefined, finishReason?: string): ExtractionResult {
  if (!content) {
    const reason = finishReason ? ` (finish_reason=${finishReason})` : '';
    return { questions: [], error: `No response from AI${reason}` };
  }
  try {
    const parsed = JSON.parse(content);
    const raw = Array.isArray(parsed) ? parsed : (parsed.questions ?? []);
    const questions: ExtractedQuestion[] = (raw as Array<Record<string, unknown>>)
      .map((q) => {
        const text = String(q.question_text ?? '').trim();
        if (!text) return null;
        const type: QuestionType = q.question_type === 'theory' ? 'theory' : 'mcq';
        const options =
          type === 'mcq' && q.options && typeof q.options === 'object'
            ? (q.options as QuestionOptions)
            : null;
        return {
          question_text: text,
          question_type: type,
          options,
          correct_answer: q.correct_answer ? String(q.correct_answer) : null,
          year: typeof q.year === 'number' ? q.year : q.year ? Number(q.year) || null : null,
        };
      })
      .filter((q): q is ExtractedQuestion => q !== null);

    return { questions, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse model output';
    return { questions: [], error: `Parse error: ${message}` };
  }
}

export async function extractQuestionsFromImageUrl(
  imageUrl: string,
): Promise<ExtractionResult> {
  try {
    const openai = client();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all exam questions (MCQ and theory) from this image:' },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'auto' } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: MAX_OUTPUT_TOKENS,
    });

    const choice = response.choices[0];
    return parseQuestions(choice?.message?.content, choice?.finish_reason);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed';
    return { questions: [], error: message };
  }
}

// Backwards-compat alias.
export const extractQuestionsFromImageDataUrl = extractQuestionsFromImageUrl;

export async function extractQuestionsFromPdfBuffer(
  buffer: ArrayBuffer,
  filename = 'paper.pdf',
): Promise<ExtractionResult> {
  try {
    const openai = client();

    // Upload to OpenAI Files API so the model can read the PDF natively.
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const file = await openai.files.create({
      file: new File([blob], filename, { type: 'application/pdf' }),
      purpose: 'user_data',
    });

    try {
      // The chat completions API accepts a `file` content type that references an uploaded file.
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: 'user',
            // The OpenAI SDK types lag the API; cast to the runtime shape.
            content: [
              { type: 'text', text: 'Extract all exam questions (MCQ and theory) from this PDF:' },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              { type: 'file', file: { file_id: file.id } } as any,
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: MAX_OUTPUT_TOKENS,
      });

      const choice = response.choices[0];
      return parseQuestions(choice?.message?.content, choice?.finish_reason);
    } finally {
      // Best-effort cleanup; ignore failures.
      openai.files.delete(file.id).catch(() => null);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed';
    return { questions: [], error: message };
  }
}

export async function extractQuestionsFromText(text: string): Promise<ExtractionResult> {
  try {
    const openai = client();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: `Extract questions from this exam paper:\n\n${text}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: MAX_OUTPUT_TOKENS,
    });
    const choice = response.choices[0];
    return parseQuestions(choice?.message?.content, choice?.finish_reason);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed';
    return { questions: [], error: message };
  }
}
