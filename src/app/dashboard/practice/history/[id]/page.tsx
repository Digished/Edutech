'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon, ArrowRightIcon, CheckIcon, ClockIcon, TrashIcon, TrophyIcon, XIcon,
} from '@/components/icons';

interface Detail {
  question_id: string;
  question_type: 'mcq' | 'theory';
  given: string;
  expected: string | null;
  correct: boolean | null;
  score: number | null;
  feedback: string | null;
}

interface SessionDetail {
  id: string;
  course_id: string | null;
  question_type: string | null;
  reveal_mode: string | null;
  total_questions: number;
  graded_count: number;
  correct_count: number;
  total_score: number | null;
  duration_ms: number | null;
  created_at: string;
  details: Detail[];
  questions: Record<string, { question_text: string; question_type: string; course?: { name: string | null } | null }>;
}

function formatDuration(ms: number | null): string {
  if (!ms || ms < 1000) return '—';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export default function PracticeHistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/practice-sessions/${id}`);
      if (cancelled) return;
      if (res.status === 401) { window.location.href = `/login?next=/dashboard/practice/history/${id}`; return; }
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not load session'); setLoading(false); return; }
      setSession(json.data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function handleDelete() {
    const res = await fetch(`/api/practice-sessions/${id}`, { method: 'DELETE' });
    if (res.ok) window.location.href = '/dashboard/practice/history';
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-zinc-400">Loading…</div>;
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <div className="max-w-lg mx-auto text-center mt-16">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Session unavailable</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{error || 'Not found'}</p>
          <Link href="/dashboard/practice/history" className="mt-4 inline-block text-sm text-green-600 hover:text-green-700">
            Back to history
          </Link>
        </div>
      </div>
    );
  }

  const percent = session.graded_count > 0 && session.total_score != null
    ? Math.round((session.total_score / session.graded_count) * 100)
    : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard/practice/history" className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 inline-flex items-center gap-1.5">
            <ArrowLeftIcon size={14} /> History
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <span
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  percent != null && percent >= 60
                    ? 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400'
                    : percent != null && percent >= 30
                    ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                }`}
              >
                <TrophyIcon size={22} />
              </span>
              <div>
                <h1 className="text-lg font-bold text-zinc-900 dark:text-white">
                  {percent != null ? `${percent}% — ${session.correct_count}/${session.graded_count} correct` : 'Session review'}
                </h1>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-2 mt-0.5">
                  <span>{new Date(session.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  <span className="inline-flex items-center gap-1"><ClockIcon size={10} /> {formatDuration(session.duration_ms)}</span>
                  <span>· {session.total_questions} question{session.total_questions === 1 ? '' : 's'}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-zinc-500 hover:text-red-600 inline-flex items-center gap-1 px-2 py-1 rounded-lg"
              title="Delete this session"
            >
              <TrashIcon size={12} /> Delete
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {session.details.map((d, i) => {
            const meta = session.questions[d.question_id];
            const correct = d.correct === true;
            const wrong = d.correct === false;
            const headPercent = d.score != null ? Math.round(d.score * 100) : null;
            return (
              <div
                key={d.question_id + i}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-zinc-900 dark:text-white">Question {i + 1}</span>
                    <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${
                      d.question_type === 'theory'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                        : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                    }`}>
                      {d.question_type.toUpperCase()}
                    </span>
                    {meta?.course?.name && <span className="text-zinc-400">· {meta.course.name}</span>}
                  </div>
                  <div className="text-xs">
                    {d.question_type === 'theory' && headPercent != null ? (
                      <span className={`font-semibold ${
                        headPercent >= 60
                          ? 'text-green-700 dark:text-green-400'
                          : headPercent >= 30
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {headPercent}%
                      </span>
                    ) : correct ? (
                      <span className="text-green-700 dark:text-green-400 inline-flex items-center gap-1 font-semibold">
                        <CheckIcon size={12} /> Correct
                      </span>
                    ) : wrong ? (
                      <span className="text-red-600 dark:text-red-400 inline-flex items-center gap-1 font-semibold">
                        <XIcon size={12} /> Wrong
                      </span>
                    ) : (
                      <span className="text-zinc-400">Ungraded</span>
                    )}
                  </div>
                </div>

                <p className="text-sm text-zinc-900 dark:text-white whitespace-pre-line leading-relaxed">
                  {meta?.question_text ?? '(question removed)'}
                </p>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="text-xs">
                    <div className="text-zinc-400 uppercase tracking-wide mb-1">Your answer</div>
                    <div className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 whitespace-pre-line min-h-[2rem]">
                      {d.given || <span className="text-zinc-400">No answer</span>}
                    </div>
                  </div>
                  {d.question_type === 'mcq' && d.expected && (
                    <div className="text-xs">
                      <div className="text-zinc-400 uppercase tracking-wide mb-1">Correct answer</div>
                      <div className="px-3 py-2 rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400">
                        {d.expected}
                      </div>
                    </div>
                  )}
                </div>

                {d.feedback && (
                  <div className="mt-3 text-xs px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300">
                    {d.feedback}
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <Link
                    href={`/questions/${d.question_id}`}
                    className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium"
                  >
                    Open question <ArrowRightIcon size={12} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-sm p-5">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">Delete this session?</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              You won&apos;t be able to review it again.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Cancel
              </button>
              <button onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium py-2 rounded-lg">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
