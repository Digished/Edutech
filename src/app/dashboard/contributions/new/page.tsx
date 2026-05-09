'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SearchSelect from '@/components/SearchSelect';
import ImageUploader from '@/components/ImageUploader';
import {
  ArrowLeftIcon, CheckIcon, PenIcon, PlusIcon, SparklesIcon, TrashIcon, XIcon,
} from '@/components/icons';
import { Brand } from '@/components/Logo';

interface Course {
  id: string;
  name: string;
  school: string;
  department: string;
  code: string | null;
}

type QType = 'mcq' | 'theory';

interface Suggestion {
  correct_answer: string;
  explanation: string;
  confidence: 'low' | 'medium' | 'high';
}

const DEFAULT_OPTIONS = ['A', 'B', 'C', 'D'];

export default function NewQuestionPage() {
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [questionType, setQuestionType] = useState<QType>('mcq');
  const [options, setOptions] = useState<{ key: string; value: string }[]>(
    DEFAULT_OPTIONS.map((k) => ({ key: k, value: '' })),
  );
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [referenceAnswer, setReferenceAnswer] = useState('');

  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggestError, setSuggestError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/courses?limit=200').then(async (r) => {
      if (r.ok) { const j = await r.json(); setCourses(j.data ?? []); }
    });
  }, []);

  function updateOption(idx: number, value: string) {
    setOptions((arr) => arr.map((o, i) => (i === idx ? { ...o, value } : o)));
  }

  function addOption() {
    if (options.length >= 6) return;
    const nextLetter = String.fromCharCode(65 + options.length);
    setOptions((arr) => [...arr, { key: nextLetter, value: '' }]);
  }

  function removeOption(idx: number) {
    if (options.length <= 2) return;
    setOptions((arr) => arr.filter((_, i) => i !== idx).map((o, i) => ({ ...o, key: String.fromCharCode(65 + i) })));
    if (correctAnswer && !options.filter((_, i) => i !== idx).some((o) => o.key === correctAnswer)) {
      setCorrectAnswer('');
    }
  }

  function buildOptionsObject() {
    const out: Record<string, string> = {};
    for (const { key, value } of options) {
      const trimmed = value.trim();
      if (trimmed) out[key] = trimmed;
    }
    return out;
  }

  async function handleSuggest() {
    setSuggestError('');
    setSuggestion(null);
    if (!questionText.trim()) {
      setSuggestError('Write the question first');
      return;
    }
    setSuggesting(true);
    try {
      const payload: Record<string, unknown> = {
        question_text: questionText,
        question_type: questionType,
      };
      if (questionType === 'mcq') payload.options = buildOptionsObject();
      const res = await fetch('/api/questions/suggest-answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setSuggestError(json.error ?? 'Could not suggest an answer');
        return;
      }
      setSuggestion(json.data);
    } catch {
      setSuggestError('Network error');
    } finally {
      setSuggesting(false);
    }
  }

  function applySuggestion() {
    if (!suggestion) return;
    if (questionType === 'mcq') {
      setCorrectAnswer(suggestion.correct_answer);
    } else {
      setReferenceAnswer(suggestion.correct_answer);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    if (!courseId) { setSubmitError('Pick a course'); return; }
    if (!questionText.trim()) { setSubmitError('Write the question'); return; }

    const opts = buildOptionsObject();
    if (questionType === 'mcq' && Object.keys(opts).length < 2) {
      setSubmitError('Add at least two options');
      return;
    }
    if (questionType === 'mcq' && correctAnswer && !opts[correctAnswer]) {
      setSubmitError('Correct answer must match one of your options');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        course_id: courseId,
        question_text: questionText.trim(),
        question_type: questionType,
        year: year === '' ? null : Number(year),
        image_urls: imageUrls,
      };
      if (questionType === 'mcq') {
        payload.options = opts;
        if (correctAnswer) payload.correct_answer = correctAnswer;
      } else {
        if (referenceAnswer.trim()) payload.correct_answer = referenceAnswer.trim();
      }
      const res = await fetch('/api/questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error ?? 'Could not submit');
        return;
      }
      setSubmitSuccess(true);
      setTimeout(() => router.push('/dashboard/contributions'), 900);
    } catch {
      setSubmitError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  const courseOptions = courses.map((c) => ({
    value: c.id,
    label: `${c.name}${c.code ? ` (${c.code})` : ''}`,
    hint: c.school,
  }));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/dashboard/contributions" className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white inline-flex items-center gap-1.5 transition-colors">
            <ArrowLeftIcon size={14} /> Contributions
          </Link>
          <Brand size="sm" href="/dashboard" />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 flex items-center justify-center">
            <PenIcon size={18} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Add a question</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Submitted questions are reviewed before they go live</p>
          </div>
        </div>

        {submitSuccess && (
          <div className="mb-5 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm px-4 py-3 rounded-lg">
            Question added to the bank. Redirecting…
          </div>
        )}

        {submitError && (
          <div className="mb-5 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Course</label>
            <SearchSelect
              options={courseOptions}
              value={courseId}
              onChange={setCourseId}
              placeholder="Pick a course"
              emptyText="No matching courses"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Question type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['mcq', 'theory'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setQuestionType(t)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    questionType === t
                      ? 'border-green-400 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/40 dark:text-green-400'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {t === 'mcq' ? 'Multiple choice' : 'Theory / essay'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Question text</label>
            <textarea
              required
              rows={4}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Type or paste the full question…"
              className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {questionType === 'mcq' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Options</label>
                <button
                  type="button"
                  onClick={addOption}
                  disabled={options.length >= 6}
                  className="text-xs text-green-600 hover:text-green-700 inline-flex items-center gap-1 disabled:opacity-40"
                >
                  <PlusIcon size={12} /> Add option
                </button>
              </div>
              <div className="space-y-2">
                {options.map((o, i) => {
                  const picked = correctAnswer === o.key;
                  return (
                    <div key={o.key} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors ${
                      picked ? 'border-green-400 bg-green-50/40 dark:border-green-700 dark:bg-green-950/30' : 'border-zinc-200 dark:border-zinc-700'
                    }`}>
                      <button
                        type="button"
                        onClick={() => setCorrectAnswer(picked ? '' : o.key)}
                        className={`w-7 h-7 rounded-md text-xs font-bold flex items-center justify-center shrink-0 ${
                          picked ? 'bg-green-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                        }`}
                        title={picked ? 'Marked as correct' : 'Mark as correct'}
                      >
                        {picked ? <CheckIcon size={14} /> : o.key}
                      </button>
                      <input
                        value={o.value}
                        onChange={(e) => updateOption(i, e.target.value)}
                        placeholder={`Option ${o.key}`}
                        className="flex-1 px-2 py-1.5 rounded-md bg-transparent text-sm text-zinc-900 dark:text-white focus:outline-none"
                      />
                      {options.length > 2 && (
                        <button type="button" onClick={() => removeOption(i)} className="text-zinc-400 hover:text-red-500 shrink-0" title="Remove option">
                          <TrashIcon size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">Click the letter to mark the correct option.</p>
            </div>
          )}

          {questionType === 'theory' && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Reference answer <span className="text-zinc-400 font-normal">(optional, used by AI grader)</span>
              </label>
              <textarea
                rows={3}
                value={referenceAnswer}
                onChange={(e) => setReferenceAnswer(e.target.value)}
                placeholder="A short ideal answer / key marking points…"
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}

          {/* AI suggest answer */}
          <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                <SparklesIcon size={14} className="text-green-600" />
                <span className="font-medium">Need help marking the answer?</span>
              </div>
              <button
                type="button"
                onClick={handleSuggest}
                disabled={suggesting}
                className="text-xs px-3 py-1.5 rounded-lg border border-green-300 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 disabled:opacity-60"
              >
                {suggesting ? 'Asking AI…' : 'Suggest answer'}
              </button>
            </div>
            {suggestError && (
              <div className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <XIcon size={12} /> {suggestError}
              </div>
            )}
            {suggestion && (
              <div className="mt-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-zinc-900 dark:text-white">Suggested:</span>
                  <code className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 text-zinc-800 dark:text-zinc-200">
                    {suggestion.correct_answer || '—'}
                  </code>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-semibold ${
                    suggestion.confidence === 'high' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' :
                    suggestion.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400' :
                    'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}>
                    {suggestion.confidence}
                  </span>
                  <button
                    type="button"
                    onClick={applySuggestion}
                    className="ml-auto text-green-700 dark:text-green-400 hover:underline"
                  >
                    Use this
                  </button>
                </div>
                {suggestion.explanation && (
                  <p className="mt-2 text-zinc-600 dark:text-zinc-400 leading-relaxed">{suggestion.explanation}</p>
                )}
              </div>
            )}
          </div>

          <ImageUploader
            value={imageUrls}
            onChange={setImageUrls}
            label="Images (optional)"
            hint="Attach diagrams, charts or any image the question refers to. Up to 8 images, 5MB each."
          />

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Year (optional)</label>
            <input
              type="number" min={1990} max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g. 2023"
              className="w-32 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm"
          >
            {submitting ? 'Adding…' : 'Add to question bank'}
          </button>
        </form>
      </div>
    </div>
  );
}
