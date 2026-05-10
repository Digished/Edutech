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
  // True when the question references a figure / diagram / chart that the
  // contributor will need to attach as an image after extraction.
  has_figure: boolean;
  // Multi-part grouping. Sub-parts that share a stem must share the same
  // `group_key` (any string — typically the parent question number "5"). A
  // standalone question has group_key = null. `stem` is required on at least
  // one row per group; subsequent rows may repeat or omit it.
  group_key: string | null;
  stem: string | null;
  part_label: string | null;
  part_position: number | null;
}

export interface ExtractionResult {
  questions: ExtractedQuestion[];
  error: string | null;
}

const EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting exam questions from Nigerian university past papers.

Two question types may be present and you MUST extract BOTH:
- "mcq" — multiple-choice questions that present options (A, B, C, D, …). Capture EVERY option that appears under the question.
- "theory" — open-ended / essay / explanation / "discuss" / "describe" / "prove" / "calculate" / "show that" / "list and explain" questions that have NO options.

MULTI-PART THEORY QUESTIONS — VERY IMPORTANT:
Many theory questions have a shared stem (a heading, a model, a passage, a diagram description) followed by several numbered or lettered sub-parts. Example:

  5. Given the model ABC ...
     (a) Define AB.
     (b) What is the coefficient of ABC?
     (c) Sketch the graph.

You MUST split this into ONE row PER sub-part, all sharing the same stem.
- Emit one row per sub-part.
- Each row carries the SAME "group_key" (use the parent number, e.g. "5").
- "stem" carries the shared heading text ("Given the model ABC ...") on every row in the group.
- "part_label" is the sub-part marker exactly as printed ("a", "b", "i", "1").
- "part_position" is the 1-based order of the sub-part within the group.
- "question_text" is ONLY the sub-part text ("Define AB."), NOT the stem.

Standalone questions (no shared stem) MUST set group_key, stem, part_label and part_position to null.

Return a JSON object of the form:
{ "questions": [ { ... }, { ... } ] }

Each item must have:
- question_text: string (the sub-part text only for grouped rows; the full question for standalone). Do NOT include the option list inside question_text — the options must live only in the options field. Do NOT repeat the stem in question_text — that goes in the "stem" field.
- question_type: "mcq" | "theory"
- options: object or null — REQUIRED for mcq. Capture EVERY printed option, keyed exactly by its label (usually A, B, C, D — sometimes E, or i/ii/iii). The value is the option text only, with the leading label, parentheses or punctuation stripped (e.g. "A. 5kg" -> "5kg"). NEVER leave options empty or null for an mcq — if you cannot read the options, mark question_type as "theory" instead. MUST be null for theory.
- correct_answer: string or null. Use the EXACT option label (e.g. "A", "B", "C") for MCQs. For theory, a short reference answer if explicitly given (per sub-part).
- year: number or null (academic year if visible on the paper)
- has_figure: boolean — true if the question text or stem refers to a figure, diagram, chart, table, image, graph, "shown below", "above", "Fig. 1", etc. that a student would need to see to answer. False otherwise.
- group_key: string or null — same value for every sub-part of a multi-part question; null for standalone.
- stem: string or null — shared heading text for multi-part rows; null for standalone.
- part_label: string or null — sub-part marker as printed; null for standalone.
- part_position: integer or null — 1-based order within the group; null for standalone.

Answer key handling — VERY IMPORTANT:
- Many Nigerian past papers print an answer key at the end of the paper, often labelled "ANSWERS", "ANSWER KEY", "SOLUTIONS", "MARKING SCHEME" or similar.
- The key is usually a list pairing question numbers with answer labels, e.g.
    1. A   2. C   3. B   4. D
    1) A  2) C  3) B
    1-A 2-C 3-B
    Q1: A, Q2: C, Q3: B
- When you find such a section, MAP each entry to its corresponding question by number (the order matches the questions you have already extracted) and set its correct_answer accordingly.
- Do not include the answer key as a question. Treat it as metadata used only to fill correct_answer.
- If both an inline answer (e.g. "Ans: B" next to a question) and an end-of-paper key are present, prefer the inline answer.
- If the key uses the option text rather than a label (e.g. "1. 25kg"), match it back to the option whose value matches and store that option's label in correct_answer.

Other rules:
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

// Detects whether a chunk of text looks like an answer key listing
// (e.g. "1. A 2. C 3. B 4. D" or "Q1: A; Q2: C"). Returns a number→label map.
function parseAnswerKey(text: string): Record<number, string> | null {
  const cleaned = text.replace(/[\r\n]+/g, ' ').trim();
  const looksLikeKey =
    /\b(answers?|answer key|marking scheme|solutions?)\b/i.test(cleaned) ||
    // Lots of `<num>. <letter>` pairs in a row.
    (cleaned.match(/\b\d{1,3}[).:\-\s]+[A-E]\b/gi) ?? []).length >= 3;
  if (!looksLikeKey) return null;

  const map: Record<number, string> = {};
  const re = /\b(\d{1,3})\s*[).:\-]?\s*([A-E])\b/gi;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n)) continue;
    map[n] = m[2].toUpperCase();
  }
  return Object.keys(map).length >= 2 ? map : null;
}

function parseQuestions(content: string | null | undefined, finishReason?: string): ExtractionResult {
  if (!content) {
    const reason = finishReason ? ` (finish_reason=${finishReason})` : '';
    return { questions: [], error: `No response from AI${reason}` };
  }
  try {
    const parsed = JSON.parse(content);
    const raw = Array.isArray(parsed) ? parsed : (parsed.questions ?? []);
    let questions: ExtractedQuestion[] = (raw as Array<Record<string, unknown>>)
      .map((q) => {
        const text = String(q.question_text ?? '').trim();
        if (!text) return null;
        let type: QuestionType = q.question_type === 'theory' ? 'theory' : 'mcq';
        let options =
          type === 'mcq' && q.options && typeof q.options === 'object'
            ? (q.options as QuestionOptions)
            : null;
        // Drop blank option values and re-evaluate. An MCQ with no real options
        // is more useful as a theory question than as a broken MCQ.
        if (options) {
          const cleaned: QuestionOptions = {};
          for (const [k, v] of Object.entries(options)) {
            const value = String(v ?? '').trim();
            if (value) cleaned[k] = value;
          }
          options = Object.keys(cleaned).length >= 2 ? cleaned : null;
          if (!options && type === 'mcq') type = 'theory';
        }
        const figureHint =
          /\b(figure|fig\.|diagram|chart|graph|table|shown below|shown above|the diagram|the figure|illustrated|the graph|the chart)\b/i.test(text);
        const has_figure =
          typeof q.has_figure === 'boolean' ? q.has_figure : figureHint;
        const groupKeyRaw = q.group_key;
        const group_key =
          groupKeyRaw === null || groupKeyRaw === undefined || groupKeyRaw === ''
            ? null
            : String(groupKeyRaw).trim() || null;
        const stemRaw = q.stem;
        const stem =
          stemRaw === null || stemRaw === undefined ? null : String(stemRaw).trim() || null;
        const partLabelRaw = q.part_label;
        const part_label =
          partLabelRaw === null || partLabelRaw === undefined
            ? null
            : String(partLabelRaw).trim() || null;
        const partPosRaw = q.part_position;
        const part_position =
          typeof partPosRaw === 'number'
            ? partPosRaw
            : partPosRaw
            ? Number(partPosRaw) || null
            : null;
        return {
          question_text: text,
          question_type: type,
          options,
          correct_answer: q.correct_answer ? String(q.correct_answer) : null,
          year: typeof q.year === 'number' ? q.year : q.year ? Number(q.year) || null : null,
          has_figure,
          // Only honour grouping when the model produced both a key and a stem;
          // otherwise treat as standalone to avoid orphaned sub-parts.
          group_key: group_key && stem ? group_key : null,
          stem: group_key && stem ? stem : null,
          part_label: group_key && stem ? part_label : null,
          part_position: group_key && stem ? part_position : null,
        };
      })
      .filter((q): q is ExtractedQuestion => q !== null);

    // Defensive sweep: if the model mis-categorised an answer key as a regular
    // question, lift the keys out and back-fill onto the MCQs in order.
    const keyMap: Record<number, string> = {};
    questions = questions.filter((q) => {
      const map = parseAnswerKey(q.question_text);
      // A real question has options or is genuinely long-form prose; an answer
      // key is short and full of letter-number pairs.
      const looksLikeKeyOnly =
        map &&
        !q.options &&
        q.question_text.length < 600 &&
        Object.keys(map).length >= 2;
      if (looksLikeKeyOnly) {
        Object.assign(keyMap, map);
        return false;
      }
      return true;
    });

    if (Object.keys(keyMap).length > 0) {
      let mcqIdx = 0;
      questions = questions.map((q) => {
        if (q.question_type !== 'mcq') return q;
        mcqIdx += 1;
        if (q.correct_answer) return q;
        const fromKey = keyMap[mcqIdx];
        if (!fromKey) return q;
        // Only accept the key answer if the question actually has that option.
        if (q.options && q.options[fromKey]) {
          return { ...q, correct_answer: fromKey };
        }
        return q;
      });
    }

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
