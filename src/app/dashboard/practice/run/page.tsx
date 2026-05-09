'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  PauseIcon,
  TrophyIcon,
  XIcon,
} from '@/components/icons';

interface Question {
  id: string;
  question_text: string;
  options: Record<string, string> | null;
  correct_answer: string | null;
  question_type: 'mcq' | 'theory';
  image_urls: string[] | null;
  courses: { name: string; school: string } | null;
}

type RevealMode = 'after_each' | 'at_end';

interface Session {
  ids: string[];
  answers: Record<string, string>;
  startedAt: number;
  courseId: string | null;
  reveal: RevealMode;
  lastIdx?: number;
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

  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [idx, setIdx] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState('');
  const [committed, setCommitted] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Per-question explanation cache, keyed by question id.
  const [explanationByQid, setExplanationByQid] = useState<Record<string, string>>({});
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanationError, setExplanationError] = useState('');
  const [finished, setFinished] = useState<{
    correct: number;
    total: number;
    details: {
      id: string;
      correct: boolean | null;
      given: string;
      expected: string | null;
      score: number | null;
      feedback: string | null;
      type: 'mcq' | 'theory';
    }[];
  } | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.replace('/dashboard/practice'); return; }
    sessionRef.current = s;
    setSession(s);

    // Resume support: if `?i=` is missing, jump to last position.
    const param = searchParams.get('i');
    let target: number;
    if (param !== null) {
      target = Math.max(0, Math.min(parseInt(param || '0'), s.ids.length - 1));
    } else {
      target = Math.max(0, Math.min(s.lastIdx ?? 0, s.ids.length - 1));
    }
    setIdx(target);
    if (param === null) router.replace(`/dashboard/practice/run?i=${target}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentId = session?.ids[idx];

  const loadQuestion = useCallback(async (qid: string, prefill: string) => {
    setLoading(true);
    setExplanationError('');
    try {
      const [qRes, eRes] = await Promise.all([
        fetch(`/api/questions/${qid}`),
        fetch(`/api/questions/${qid}/explain`),
      ]);
      const qJson = await qRes.json();
      setQuestion(qJson.data ?? null);
      setAnswer(prefill);
      setCommitted(prefill);
      if (eRes.ok) {
        const eJson = await eRes.json();
        const cached = eJson?.data?.explanation;
        if (cached) {
          setExplanationByQid((m) => ({ ...m, [qid]: cached }));
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  async function loadExplanation() {
    if (!currentId) return;
    if (explanationLoading) return;
    setExplanationError('');
    setExplanationLoading(true);
    try {
      const res = await fetch(`/api/questions/${currentId}/explain`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setExplanationError(json.error ?? 'Could not load the explanation');
        return;
      }
      const text: string = json.data?.explanation ?? '';
      if (text) setExplanationByQid((m) => ({ ...m, [currentId]: text }));
    } catch {
      setExplanationError('Network error');
    } finally {
      setExplanationLoading(false);
    }
  }

  useEffect(() => {
    if (!currentId || !sessionRef.current) return;
    const prefill = sessionRef.current.answers[currentId] ?? '';
    loadQuestion(currentId, prefill);
    // Track position so resuming returns here.
    sessionRef.current.lastIdx = idx;
    saveSession(sessionRef.current);
  }, [currentId, idx, loadQuestion]);

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

  function pauseAndExit() {
    persistAnswer(answer);
    if (sessionRef.current) {
      sessionRef.current.lastIdx = idx;
      saveSession(sessionRef.current);
    }
    router.push('/dashboard');
  }

  async function finish() {
    const s = sessionRef.current;
    if (!s) return;
    setSubmitting(true);
    try {
      const details = await Promise.all(
        s.ids.map(async (qid) => {
          const given = (s.answers[qid] ?? '').trim();
          const baseRes = await fetch(`/api/questions/${qid}`);
          const baseJson = await baseRes.json();
          const q: Question | null = baseJson.data ?? null;
          if (!q) {
            return {
              id: qid,
              correct: null,
              given,
              expected: null,
              score: null,
              feedback: null,
              type: 'mcq' as const,
            };
          }

          // MCQ: case-insensitive label match, also accept the option text.
          if (q.question_type === 'mcq') {
            const expected = q.correct_answer ?? null;
            if (!given) {
              return { id: qid, correct: false, given, expected, score: 0, feedback: null, type: 'mcq' as const };
            }
            const givenLetter = given.charAt(0).toUpperCase();
            const matchByLabel = expected ? givenLetter === expected.trim().toUpperCase() : false;
            const matchByValue = expected && q.options
              ? Object.entries(q.options).some(
                  ([k, v]) =>
                    k === expected && v.trim().toLowerCase() === given.toLowerCase(),
                )
              : false;
            const correct = expected ? matchByLabel || matchByValue : null;
            return {
              id: qid,
              correct,
              given,
              expected,
              score: correct === null ? null : correct ? 1 : 0,
              feedback: null,
              type: 'mcq' as const,
            };
          }

          // Theory: ask the AI to grade closeness.
          if (!given) {
            return {
              id: qid, correct: false, given, expected: q.correct_answer,
              score: 0, feedback: 'No answer provided.', type: 'theory' as const,
            };
          }
          try {
            const gradeRes = await fetch('/api/questions/grade-theory', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ question_id: qid, answer: given }),
            });
            if (!gradeRes.ok) throw new Error('grade failed');
            const gradeJson = await gradeRes.json();
            const grade = gradeJson.data as { score: number; is_correct: boolean; feedback: string };
            return {
              id: qid,
              correct: grade.is_correct,
              given,
              expected: q.correct_answer,
              score: grade.score,
              feedback: grade.feedback,
              type: 'theory' as const,
            };
          } catch {
            return {
              id: qid, correct: null, given, expected: q.correct_answer,
              score: null, feedback: 'AI grader unavailable — review manually.', type: 'theory' as const,
            };
          }
        }),
      );
      const correct = details.filter((d) => d.correct === true).length;
      setFinished({ correct, total: s.ids.length, details });
      sessionStorage.removeItem('practice_session');
      // Persist the run so the user can review it later.
      try {
        await fetch('/api/practice-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            course_id: s.courseId,
            reveal_mode: s.reveal,
            total_questions: s.ids.length,
            duration_ms: Date.now() - (s.startedAt ?? Date.now()),
            details: details.map((d) => ({
              question_id: d.id,
              question_type: d.type,
              given: d.given ?? '',
              expected: d.expected ?? null,
              correct: d.correct,
              score: d.score,
              feedback: d.feedback ?? null,
            })),
          }),
        });
      } catch { /* swallow — review still available locally */ }
    } finally {
      setSubmitting(false);
    }
  }

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-zinc-400">Loading…</div>;
  }

  if (finished) {
    const gradable = finished.details.filter((d) => d.score !== null).length;
    const totalScore = finished.details.reduce((s, d) => s + (d.score ?? 0), 0);
    const percent = gradable > 0 ? Math.round((totalScore / gradable) * 100) : null;
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
          <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-2">
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
              <ArrowLeftIcon size={14} /> Dashboard
            </Link>
          </div>
        </nav>
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center">
            <span className="inline-flex w-14 h-14 rounded-full bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 items-center justify-center mb-3">
              <TrophyIcon size={26} />
            </span>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Exam complete</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {gradable > 0 ? (
                <>
                  Overall score{' '}
                  <span className="font-semibold text-green-700 dark:text-green-400">{percent}%</span>
                  {' '}across {gradable} graded question{gradable === 1 ? '' : 's'} ({finished.correct} fully correct)
                </>
              ) : (
                <>All questions submitted. Some couldn&apos;t be auto-graded.</>
              )}
            </p>
          </div>

          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mt-8 mb-3">Review</h2>
          <div className="space-y-2">
            {finished.details.map((d, i) => (
              <Link key={d.id} href={`/questions/${d.id}`}
                className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 hover:border-green-300 transition-colors">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-900 dark:text-white">Question {i + 1}</div>
                    {d.feedback && (
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{d.feedback}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {d.type === 'theory' && d.score !== null ? (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          d.score >= 0.6
                            ? 'text-green-700 dark:text-green-400'
                            : d.score >= 0.3
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {Math.round(d.score * 100)}%
                      </span>
                    ) : d.correct === true ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400">
                        <CheckIcon size={14} /> Correct
                      </span>
                    ) : d.correct === false ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                        <XIcon size={14} /> {d.given || '—'}
                        {d.expected ? <> · ans: {d.expected}</> : null}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">Ungraded · view</span>
                    )}
                  </div>
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
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between gap-3">
          <button
            onClick={pauseAndExit}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            title="Save progress and exit"
          >
            <PauseIcon size={14} /> Pause
          </button>
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

              {Array.isArray(question.image_urls) && question.image_urls.length > 0 && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {question.image_urls.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={`${url}-${i}`}
                      src={url}
                      alt=""
                      className="w-full h-auto max-h-64 object-contain rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800"
                    />
                  ))}
                </div>
              )}

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
                          className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors flex items-center justify-between gap-2 ${
                            isThisCorrect
                              ? 'border-green-400 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-300'
                              : isThisWrongPick
                              ? 'border-red-400 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300'
                              : picked
                              ? 'border-green-400 bg-green-50/50 text-zinc-900 dark:border-green-700 dark:bg-green-950/40 dark:text-white'
                              : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                          } ${reveal ? 'cursor-not-allowed' : ''}`}
                        >
                          <span><span className="font-semibold mr-2">{k}.</span>{v}</span>
                          {isThisCorrect && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold shrink-0">
                              <CheckIcon size={14} /> Correct
                            </span>
                          )}
                          {isThisWrongPick && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold shrink-0">
                              <XIcon size={14} /> Your answer
                            </span>
                          )}
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
                <div className={`mt-4 rounded-lg px-4 py-3 text-sm inline-flex items-center gap-2 ${
                  isCorrect
                    ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'
                    : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
                }`}>
                  {isCorrect ? <CheckIcon size={16} /> : <XIcon size={16} />}
                  {isCorrect
                    ? 'Correct!'
                    : `Not quite. The correct answer is ${question.correct_answer}.`}
                </div>
              )}

              {/* Explanation — shows once the user has chosen / written something. */}
              {currentId && (committed || answer.trim()) && (
                <div className="mt-5 pt-5 border-t border-zinc-100 dark:border-zinc-800">
                  {explanationByQid[currentId] ? (
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Explanation</h3>
                      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed whitespace-pre-line">
                        {explanationByQid[currentId]}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Stuck on the answer?</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                          Get a step-by-step walkthrough in plain English.
                        </p>
                      </div>
                      <button
                        onClick={loadExplanation}
                        disabled={explanationLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-green-300 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 disabled:opacity-60"
                      >
                        {explanationLoading ? 'Preparing the explanation…' : 'Explain the answer'}
                      </button>
                    </div>
                  )}
                  {explanationError && (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">{explanationError}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={() => goTo(idx - 1)}
            disabled={idx === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <ArrowLeftIcon size={14} /> Previous
          </button>
          {isLast ? (
            <button
              onClick={() => { persistAnswer(answer); finish(); }}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
            >
              <TrophyIcon size={14} />
              {submitting ? 'Grading…' : 'Finish exam'}
            </button>
          ) : (
            <button
              onClick={() => { persistAnswer(answer); goTo(idx + 1); }}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg"
            >
              Next question <ArrowRightIcon size={14} />
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
