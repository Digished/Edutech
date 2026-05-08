// ============================================================
// OCR / Extraction Pipeline — modular, async-ready
// Integrates with OpenAI Vision for PDF/image question extraction
// ============================================================

import OpenAI from 'openai';
import { QuestionOptions } from '@/types/database';

export interface ExtractedQuestion {
  question_text: string;
  options: QuestionOptions | null;
  correct_answer: string | null;
  year: number | null;
}

export interface ExtractionResult {
  questions: ExtractedQuestion[];
  error: string | null;
}

const EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting exam questions from Nigerian university exam papers.
Extract all multiple-choice and theory questions from the provided text or image.
Return a valid JSON array of question objects. Each object must have:
- question_text: string (the full question)
- options: object or null ({"A":"...", "B":"...", "C":"...", "D":"..."} for MCQs)
- correct_answer: string or null (option key like "A", "B" if visible)
- year: number or null (academic year if detectable)
Return ONLY the JSON array, no explanation.`;

export async function extractQuestionsFromText(
  text: string,
): Promise<ExtractionResult> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: `Extract questions from this exam paper:\n\n${text}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { questions: [], error: 'No response from AI' };

    const parsed = JSON.parse(content);
    const questions: ExtractedQuestion[] = Array.isArray(parsed)
      ? parsed
      : parsed.questions ?? [];

    return { questions, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed';
    return { questions: [], error: message };
  }
}

export async function extractQuestionsFromImageUrl(
  imageUrl: string,
): Promise<ExtractionResult> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all exam questions from this image:' },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { questions: [], error: 'No response from AI' };

    const parsed = JSON.parse(content);
    const questions: ExtractedQuestion[] = Array.isArray(parsed)
      ? parsed
      : parsed.questions ?? [];

    return { questions, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed';
    return { questions: [], error: message };
  }
}
