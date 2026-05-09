// ============================================================
// AI helpers for question authoring & answer scoring
// ============================================================

import OpenAI from 'openai';
import { QuestionOptions, QuestionType } from '@/types/database';

const REQUEST_TIMEOUT_MS = 60_000;

function client(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: REQUEST_TIMEOUT_MS,
  });
}

export interface SuggestedAnswer {
  correct_answer: string;
  explanation: string;
  confidence: 'low' | 'medium' | 'high';
}

const SUGGEST_PROMPT = `You are helping a Nigerian university past-question contributor mark the correct answer.
You will be given a question and (for MCQs) its options. Choose the most likely correct answer based on standard course content.

Return a JSON object: { "correct_answer": "<value>", "explanation": "<one sentence>", "confidence": "low" | "medium" | "high" }

For MCQs, "correct_answer" MUST be the option label exactly (e.g. "A", "B", "C", "D").
For theory questions, "correct_answer" is a SHORT reference answer (1-2 sentences).
If you are not at least medium confident, set confidence to "low" and still propose your best guess.
Return ONLY the JSON object — no markdown, no preamble.`;

export async function suggestAnswer(
  questionText: string,
  questionType: QuestionType,
  options: QuestionOptions | null,
): Promise<SuggestedAnswer> {
  const userMessage =
    questionType === 'mcq' && options
      ? `Question: ${questionText}\n\nOptions:\n${Object.entries(options)
          .map(([k, v]) => `${k}. ${v}`)
          .join('\n')}`
      : `Theory question: ${questionText}`;

  const openai = client();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SUGGEST_PROMPT },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 400,
  });

  const content = response.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content) as Partial<SuggestedAnswer>;
  const confidence: SuggestedAnswer['confidence'] =
    parsed.confidence === 'high' || parsed.confidence === 'medium' ? parsed.confidence : 'low';

  let correct = String(parsed.correct_answer ?? '').trim();
  if (questionType === 'mcq' && options) {
    // Coerce to the matching option label.
    const upper = correct.charAt(0).toUpperCase();
    if (options[upper]) {
      correct = upper;
    } else {
      // Try matching by value text.
      const match = Object.entries(options).find(
        ([, v]) => v.trim().toLowerCase() === correct.toLowerCase(),
      );
      if (match) correct = match[0];
    }
  }

  return {
    correct_answer: correct,
    explanation: String(parsed.explanation ?? '').trim(),
    confidence,
  };
}

export interface TheoryGrade {
  // 0–1 score for how close the candidate answer is to the reference.
  score: number;
  // Boolean derived from score >= 0.6.
  is_correct: boolean;
  feedback: string;
}

const GRADE_PROMPT = `You are an expert university lecturer grading short-answer / theory exam responses.
You are given the question, the student's answer, and (optionally) a reference answer.
Decide how close the student's answer is to a fully correct one.

Return a JSON object: { "score": <number 0-1, two decimals>, "feedback": "<two short sentences>" }

Scoring rubric:
- 1.00 : essentially correct, all key ideas present.
- 0.80 : mostly correct, missing minor detail.
- 0.60 : partially correct, captures the main idea but with errors or omissions.
- 0.40 : on the right track but largely incomplete or confused.
- 0.20 : barely related to the question.
- 0.00 : blank, off-topic or completely wrong.

Be strict but fair. Reward correct reasoning even when wording differs.
Return ONLY the JSON object — no markdown, no preamble.`;

export interface ExplanationResult {
  explanation: string;
}

const EXPLANATION_PROMPT = `You are a patient university tutor. A student is studying for an exam and has just been told the correct answer to a past question. Explain WHY that answer is correct.

Write the explanation as if you are speaking directly to the student. Use plain, everyday English — short sentences, no jargon unless you immediately define it. Walk through the reasoning step by step. Show any small calculation in full so the student can follow.

Structure (use these exact headings, no other formatting tricks):

Quick answer: <one short line stating the correct answer in words>
Why: <2-4 short paragraphs walking the student through the reasoning>
Common mistake: <one or two sentences on the most likely wrong choice and why it tempts students. Skip this section for theory questions.>

Rules:
- Be ACCURATE. If the question is genuinely ambiguous or the marked answer looks wrong, say so plainly.
- Never refer to yourself, "AI", "the model", "as a language model", etc. Speak as a tutor.
- Don't start with "Sure" / "Of course" / "Great question" — get straight to the explanation.
- Don't restate the question verbatim.
- Use simple analogies where they help. Keep total length under ~250 words unless the question really needs more.`;

export async function generateExplanation(
  questionText: string,
  questionType: QuestionType,
  options: QuestionOptions | null,
  correctAnswer: string | null,
): Promise<ExplanationResult> {
  const optionsBlock =
    questionType === 'mcq' && options
      ? `\n\nOptions:\n${Object.entries(options)
          .map(([k, v]) => `${k}. ${v}`)
          .join('\n')}`
      : '';
  const answerBlock = correctAnswer
    ? `\n\nMarked correct answer: ${correctAnswer}`
    : '\n\nNo official answer was recorded — work out the most defensible answer first, then explain it.';

  const userMessage = `Question (${questionType.toUpperCase()}):\n${questionText}${optionsBlock}${answerBlock}`;

  const openai = client();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: EXPLANATION_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.2,
    max_tokens: 700,
  });

  const content = response.choices[0]?.message?.content?.trim() ?? '';
  return { explanation: content };
}

export async function gradeTheoryAnswer(
  questionText: string,
  studentAnswer: string,
  referenceAnswer: string | null,
): Promise<TheoryGrade> {
  if (!studentAnswer.trim()) {
    return { score: 0, is_correct: false, feedback: 'No answer was provided.' };
  }

  const openai = client();
  const userMessage = [
    `Question: ${questionText}`,
    referenceAnswer ? `Reference answer: ${referenceAnswer}` : 'No reference answer provided — judge from your own knowledge.',
    `Student answer: ${studentAnswer}`,
  ].join('\n\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: GRADE_PROMPT },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 250,
  });

  const content = response.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content) as { score?: number; feedback?: string };
  const rawScore = typeof parsed.score === 'number' ? parsed.score : Number(parsed.score) || 0;
  const score = Math.max(0, Math.min(1, rawScore));
  return {
    score: parseFloat(score.toFixed(2)),
    is_correct: score >= 0.6,
    feedback: String(parsed.feedback ?? '').trim(),
  };
}
