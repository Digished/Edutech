'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Contribution {
  id: string;
  type: 'upload' | 'extraction' | 'correction' | 'edit' | 'moderation';
  weight: number;
  created_at: string;
  questions: { question_text: string; courses: { name: string } | null } | null;
}

export default function ContributionsPage() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const limit = 20;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/contributions?page=${page}&limit=${limit}`);
        if (!res.ok) {
          window.location.href = '/login';
          return;
        }
        const json = await res.json();
        setContributions(json.data ?? []);
        setTotal(json.total ?? 0);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  const typeLabel: Record<string, string> = {
    upload: 'Uploaded paper',
    extraction: 'Extracted question',
    correction: 'Corrected answer',
    edit: 'Edited question',
    moderation: 'Moderation action',
  };

  const typeBadge: Record<string, string> = {
    upload: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
    extraction: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    correction: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
    edit: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
    moderation: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors">
            ← Dashboard
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-green-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">E</span>
            </div>
            <span className="font-semibold text-zinc-900 dark:text-white text-sm">EduTech</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">My contributions</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {total.toLocaleString()} contribution{total !== 1 ? 's' : ''} — these determine your share of revenue distributions
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 animate-pulse">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-2/3 mb-2" />
                <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : contributions.length === 0 ? (
          <div className="text-center py-16 text-zinc-400 dark:text-zinc-500">
            <div className="text-4xl mb-3">✍️</div>
            <p className="font-medium">No contributions yet</p>
            <p className="text-sm mt-1">Upload a past paper or submit a question to get started</p>
            <div className="flex items-center justify-center gap-3 mt-5">
              <Link
                href="/dashboard/uploads"
                className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Upload a paper
              </Link>
              <Link
                href="/questions"
                className="text-sm border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg transition-colors"
              >
                Browse questions
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {contributions.map((c) => (
                <div key={c.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeBadge[c.type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                          {typeLabel[c.type] ?? c.type}
                        </span>
                        <span className="text-xs text-zinc-400">
                          {new Date(c.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      {c.questions && (
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed line-clamp-2">
                          {c.questions.question_text}
                        </p>
                      )}
                      {c.questions?.courses && (
                        <div className="text-xs text-zinc-400 mt-1">{c.questions.courses.name}</div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white">×{c.weight}</div>
                      <div className="text-xs text-zinc-400">weight</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-zinc-500 dark:text-zinc-400 px-2">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
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
