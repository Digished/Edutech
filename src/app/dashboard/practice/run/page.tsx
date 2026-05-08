'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface Question {
  id: string;
  question_text: string;
  options: Record<string, string> | null;
  correct_answer: string | null;
  question_type: 'mcq' | 'theory';
  courses: { name: string; school: string } | null;
}

type RevealMode = 'after_each' | 'at_end';

interface Session {
  ids: string[];
  answers: Record<string, string>;
  startedAt: number;
  courseId: string | null;
  reveal: RevealMode;
}

function loadSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem('practice_session');
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    if (!s.reveal) s.reveal = 'at_end';
    return s;
  } catch { return null; }
}

function saveSession(s: Session) {
  sessionStorage.setItem('practice_session', JSON.stringify(s));
}

function PracticeRunInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialIdx = parseInt(searchParams.get('i') ?? '0');

  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [idx, setIdx] = useState(initialIdx);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState('');
  const [committed, setCommitted] = useState<string>(''); // for after_each MCQs: the committed selection
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState<{ correct: number; total: number; details: { id: string; correct: boolean | null; given: string; expected: string | null }[] } | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.replace('/dashboard/practice'); return; }
    sessionRef.current = s;
    setSession(s);
  }, [router]);

  const currentId = session?.ids[idx];

  const loadQuestion = useCallback(async (qid: string, prefill: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/questions/${qid}`);
      const json = await res.json();
      setQuestion(json.data ?? null);
      setAnswer(prefill);
      setCommitted(prefill);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload when navigating to a different question — NOT on every keystroke.
  useEffect(() => {
    if (!currentId || !sessionRef.current) return;
    const prefill = sessionRef.current.answers[currentId] ?? '';
    loadQuestion(currentId, prefill);
  }, [currentId, loadQuestion]);

  function persistAnswer(value: string) {
    const s = sessionRef.current;
    if (!s || !currentId) return;
    s.answers[currentId] = value;
    saveSession(s);
  }

  function pickMcq(k: string) {
    setAnswer(k);
    setCommitted(k);
    persistAnswer(k);
  }

  function goTo(target: number) {
    if (!session) return;
    if (target < 0 || target >= session.ids.length) return;
    setIdx(target);
    router.replace(`/dashboard/practice/run?i=${target}`);
  }

  async function finish() {
    const s = sessionRef.current;
    if (!s) return;
    setSubmitting(true);
    try {
      const details = await Promise.all(
        s.ids.map(async (qid) => {
          const given = s.answers[qid] ?? '';
          if (!given) return { id: qid, correct: null, given, expected: null };
          const res = await fetch(`/api/questions/${qid}`);
          const json = await res.json();
          const q: Question | null = json.data ?? null;
          if (!q) return { id: qid, correct: null, given, expected: null };
          if (q.question_type === 'mcq' && q.correct_answer) {
            return { id: qid, correct: given === q.correct_answer, given, expected: q.correct_answer };
          }
          return { id: qid, correct: null, given, expected: null };
        }),
      );
      const correct = details.filter((d) => d.correct === true).length;
      setFinished({ correct, total: s.ids.length, details });
      sessionStorage.removeItem('practice_session');
    } finally {
      setSubmitting(false);
    }
  }

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-zinc-400">Loading…</div>;
  }

  if (finished) {
    const gradable = finished.details.filter((d) => d.correct !== null).length;
    const score = gradable > 0 ? Math.round((finished.correct / gradable) * 100) : null;
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
          <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700">← Dashboard</Link>
          </div>
        </nav>
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-3">{score !== null && score >= 70 ? '🎉' : score !== null ? '📘' : '✅'}</div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Exam complete</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {gradable > 0 ? (
                <>
                  You scored{' '}
                  <span className="font-semibold text-green-700 dark:text-green-400">{finished.correct}</span>
                  {' '}/ {gradable} graded MCQ{gradable === 1 ? '' : 's'} · {score}%
                </>
              ) : (
                <>All questions submitted. Theory questions aren&apos;t auto-graded.</>
              )}
            </p>
          </div>

          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mt-8 mb-3">Review</h2>
          <div className="space-y-2">
            {finished.details.map((d, i) => (
              <Link key={d.id} href={`/questions/${d.id}`}
                className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 hover:border-green-300 transition-colors">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-zinc-900 dark:text-white">Question {i + 1}</span>
                  {d.correct === true && <span className="text-xs font-semibold text-green-700 dark:text-green-400">✓ Correct</span>}
                  {d.correct === false && (
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                      ✗ You picked {d.given || '—'} · correct: {d.expected}
                    </span>
                  )}
                  {d.correct === null && <span className="text-xs text-zinc-400">Ungraded · view</span>}
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-8 flex gap-3">
            <Link href="/dashboard/practice"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg">
              Take another exam
            </Link>
            <Link href="/dashboard"
              className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-sm rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const total = session.ids.length;
  const isLast = idx === total - 1;
  const answered = Object.values(session.answers).filter((v) => v && v.trim()).length;
  const showImmediateMcqFeedback =
    session.reveal === 'after_each' &&
    !!question &&
    question.question_type === 'mcq' &&
    !!committed &&
    !!question.correct_answer;
  const isCorrect = showImmediateMcqFeedback && committed === question!.correct_answer;
  const progressPct = Math.round(((idx + 1) / total) * 100);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700">← Exit</Link>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Question <span className="font-semibold text-zinc-900 dark:text-white">{idx + 1}</span> / {total} · {answered} answered
          </span>
        </div>
        <div className="h-1 bg-zinc-100 dark:bg-zinc-800">
          <div className="h-full bg-green-600 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          {loading || !question ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-1/3" />
              <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-5/6" />
              <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-2/3" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${
                  question.question_type === 'theory'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                    : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                }`}>
                  {question.question_type === 'theory' ? 'Theory' : 'MCQ'}
                </span>
                {question.courses && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {question.courses.name} · {question.courses.school}
                  </span>
                )}
              </div>

              <p className="text-zinc-900 dark:text-white leading-relaxed font-medium whitespace-pre-line">
                {question.question_text}
              </p>

              <div className="mt-5">
                {question.question_type === 'mcq' && question.options ? (
                  <div className="space-y-2">
                    {Object.entries(question.options).map(([k, v]) => {
                      const picked = answer === k;
                      const reveal = showImmediateMcqFeedback;
                      const isThisCorrect = reveal && k === question.correct_answer;
                      const isThisWrongPick = reveal && picked && !isThisCorrect;
                      return (
                        <button
                          key={k}
                          type="button"
                          disabled={reveal}
                          onClick={() => pickMcq(k)}
                          className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                            isThisCorrect
                              ? 'border-green-400 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-300'
                              : isThisWrongPick
                              ? 'border-red-400 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300'
                              : picked
                              ? 'border-green-400 bg-green-50/50 text-zinc-900 dark:border-green-700 dark:bg-green-950/40 dark:text-white'
                              : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                          } ${reveal ? 'cursor-not-allowed' : ''}`}
                        >
                          <span className="font-semibold mr-2">{k}.</span>
                          {v}
                          {isThisCorrect && <span className="float-right text-xs font-semibold">✓ Correct</span>}
                          {isThisWrongPick && <span className="float-right text-xs font-semibold">✗ Your answer</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onBlur={() => persistAnswer(answer)}
                    placeholder="Write your answer here. It auto-saves when you leave the field."
                    rows={6}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                )}
              </div>

              {showImmediateMcqFeedback && (
                <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                  isCorrect
                    ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
                }`}>
                  {isCorrect
                    ? '✓ Correct!'
                    : `✗ Not quite. The correct answer is ${question.correct_answer}.`}
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={() => goTo(idx - 1)}
            disabled={idx === 0}
            className="px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            ← Previous
          </button>
          {isLast ? (
            <button
              onClick={() => { persistAnswer(answer); finish(); }}
              disabled={submitting}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
            >
              {submitting ? 'Grading…' : 'Finish exam'}
            </button>
          ) : (
            <button
              onClick={() => { persistAnswer(answer); goTo(idx + 1); }}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg"
            >
              Next question →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PracticeRunPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-zinc-400">Loading…</div>}>
      <PracticeRunInner />
    </Suspense>
  );
}
