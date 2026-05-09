'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon, ArrowRightIcon, ClockIcon, FlaskIcon, TrophyIcon,
} from '@/components/icons';
import { Brand } from '@/components/Logo';

interface SessionSummary {
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
}

function formatDuration(ms: number | null): string {
  if (!ms || ms < 1000) return '—';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export default function PracticeHistoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await fetch(`/api/practice-sessions?page=${page}&limit=${limit}`);
      if (cancelled) return;
      if (res.status === 401) { window.location.href = '/login?next=/dashboard/practice/history'; return; }
      if (res.ok) {
        const j = await res.json();
        setSessions(j.data ?? []);
        setTotal(j.total ?? 0);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white inline-flex items-center gap-1.5 transition-colors">
            <ArrowLeftIcon size={14} /> Dashboard
          </Link>
          <Brand size="sm" href="/dashboard" />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Practice history</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Review every exam you&apos;ve taken — see your score, what you got wrong and the explanations.
            </p>
          </div>
          <Link
            href="/dashboard/practice"
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            <FlaskIcon size={14} /> Take a new exam
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 text-zinc-400 dark:text-zinc-500">
            <FlaskIcon size={36} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
            <p className="font-medium">No practice exams yet</p>
            <p className="text-sm mt-1">Take a practice exam to start building your history.</p>
            <Link
              href="/dashboard/practice"
              className="mt-5 inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              Start practicing
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {sessions.map((s) => {
                const percent = s.graded_count > 0 && s.total_score != null
                  ? Math.round((s.total_score / s.graded_count) * 100)
                  : null;
                return (
                  <Link
                    key={s.id}
                    href={`/dashboard/practice/history/${s.id}`}
                    className="group block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 hover:border-green-300 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-3">
                        <span
                          className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                            percent != null && percent >= 60
                              ? 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400'
                              : percent != null && percent >= 30
                              ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                              : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          <TrophyIcon size={18} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-zinc-900 dark:text-white">
                            {s.total_questions} question{s.total_questions === 1 ? '' : 's'}
                            {s.question_type && s.question_type !== 'all' ? ` · ${s.question_type.toUpperCase()}` : ''}
                          </div>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-2 mt-0.5">
                            <span>{new Date(s.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            <span className="inline-flex items-center gap-1"><ClockIcon size={10} /> {formatDuration(s.duration_ms)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {percent != null ? (
                          <div
                            className={`text-base font-semibold ${
                              percent >= 60
                                ? 'text-green-700 dark:text-green-400'
                                : percent >= 30
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {percent}%
                          </div>
                        ) : (
                          <div className="text-sm text-zinc-400">No score</div>
                        )}
                        <div className="text-[11px] text-zinc-400 inline-flex items-center gap-1">
                          {s.correct_count}/{s.graded_count || s.total_questions} correct
                          <ArrowRightIcon size={10} className="ml-1 text-zinc-400 group-hover:text-green-600 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  Previous
                </button>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
