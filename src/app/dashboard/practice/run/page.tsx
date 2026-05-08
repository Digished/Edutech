'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
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

interface Session {
  ids: string[];
  answers: Record<string, string>;
  startedAt: number;
  courseId: string | null;
}

function loadSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem('practice_session');
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; } catch { return null; }
}

function saveSession(s: Session) {
  sessionStorage.setItem('practice_session', JSON.stringify(s));
}

function PracticeRunInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialIdx = parseInt(searchParams.get('i') ?? '0');

  const [session, setSession] = useState<Session | null>(null);
  const [idx, setIdx] = useState(initialIdx);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState<{ correct: number; total: number; details: { id: string; correct: boolean | null; given: string; expected: string | null }[] } | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.replace('/dashboard/practice'); return; }
    setSession(s);
  }, [router]);

  const currentId = session?.ids[idx];

  const loadQuestion = useCallback(async (qid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/questions/${qid}`);
      const json = await res.json();
      setQuestion(json.data ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentId) return;
    loadQuestion(currentId);
    const stored = session?.answers[currentId] ?? '';
    setAnswer(stored);
  }, [currentId, loadQuestion, session]);

  function persistAnswer(value: string) {
    if (!session || !currentId) return;
    const next = { ...session, answers: { ...session.answers, [currentId]: value } };
    setSession(next);
    saveSession(next);
  }

  function goTo(target: number) {
    if (!session) return;
    if (target < 0 || target >= session.ids.length) return;
    setIdx(target);
    router.replace(`/dashboard/practice/run?i=${target}`);
  }

  async function finish() {
    if (!session) return;
    setSubmitting(true);
    try {
      const details = await Promise.all(
        session.ids.map(async (qid) => {
          const given = session.answers[qid] ?? '';
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
      setFinished({ correct, total: session.ids.length, details });
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
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
          <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700">← Dashboard</Link>
          </div>
        </nav>
        <div className="max-w-3xl mx-auto px-6 py-10">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Exam complete</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            You scored <span className="font-semibold text-green-700 dark:text-green-400">{finished.correct}</span> out of {gradable} graded MCQs ({finished.total} total).
          </p>
          <div className="mt-6 space-y-3">
            {finished.details.map((d, i) => (
              <Link key={d.id} href={`/questions/${d.id}`}
                className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 hover:border-green-300">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-900 dark:text-white">Question {i + 1}</span>
                  {d.correct === true && <span className="text-xs font-semibold text-green-700 dark:text-green-400">✓ Correct</span>}
                  {d.correct === false && <span className="text-xs font-semibold text-red-600 dark:text-red-400">✗ {d.given || '—'} (correct: {d.expected})</span>}
                  {d.correct === null && <span className="text-xs text-zinc-400">Ungraded</span>}
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700">← Exit</Link>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Question {idx + 1} of {total} · {answered} answered
          </span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          {loading || !question ? (
            <p className="text-sm text-zinc-400">Loading question…</p>
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
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => { setAnswer(k); persistAnswer(k); }}
                          className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                            picked
                              ? 'border-green-400 bg-green-50/50 text-zinc-900 dark:border-green-700 dark:bg-green-950/40 dark:text-white'
                              : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <span className="font-semibold mr-2">{k}.</span>
                          {v}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <textarea
                    value={answer}
                    onChange={(e) => { setAnswer(e.target.value); persistAnswer(e.target.value); }}
                    placeholder="Write your answer here."
                    rows={6}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                )}
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => goTo(idx - 1)}
            disabled={idx === 0}
            className="px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Previous
          </button>
          {isLast ? (
            <button
              onClick={finish}
              disabled={submitting}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
            >
              {submitting ? 'Grading…' : 'Finish exam'}
            </button>
          ) : (
            <button
              onClick={() => goTo(idx + 1)}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg"
            >
              Next question
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
