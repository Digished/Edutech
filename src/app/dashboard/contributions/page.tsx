'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  PenIcon, ArrowLeftIcon, UploadIcon, ArrowRightIcon, PlusIcon, SparklesIcon,
} from '@/components/icons';
import WalletPanel from '@/components/WalletPanel';
import { Brand } from '@/components/Logo';

interface Contribution {
  id: string;
  contribution_type: 'upload' | 'extraction' | 'correction' | 'edit' | 'moderation';
  created_at: string;
  questions: {
    question_text: string;
    status: 'pending' | 'approved' | 'rejected';
    is_deleted: boolean;
    courses: { name: string } | null;
  } | null;
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
        if (!res.ok) { window.location.href = '/login'; return; }
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
      <nav className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
            <ArrowLeftIcon size={14} /> Dashboard
          </Link>
          <Brand size="sm" href="/dashboard" />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Contributions & wallet</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {total.toLocaleString()} contribution{total !== 1 ? 's' : ''} so far. Approved questions earn for you.
          </p>
        </div>

        <div id="wallet" className="mb-6">
          <WalletPanel />
        </div>

        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Add to the bank</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <Link
            href="/dashboard/contributions/new"
            className="group flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-green-300"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 flex items-center justify-center">
                <PlusIcon size={16} />
              </span>
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-white">Add a single question</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-1">
                  <SparklesIcon size={11} className="text-green-600" /> AI can suggest the answer
                </div>
              </div>
            </div>
            <ArrowRightIcon size={14} className="text-zinc-400 group-hover:text-green-600 group-hover:translate-x-0.5 transition" />
          </Link>
          <Link
            href="/dashboard/uploads"
            className="group flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-green-300"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 flex items-center justify-center">
                <UploadIcon size={16} />
              </span>
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-white">Upload a past paper</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">AI extracts the questions for you</div>
              </div>
            </div>
            <ArrowRightIcon size={14} className="text-zinc-400 group-hover:text-green-600 group-hover:translate-x-0.5 transition" />
          </Link>
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
            <PenIcon size={36} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
            <p className="font-medium">No contributions yet</p>
            <p className="text-sm mt-1">Add a question or upload a past paper to get started</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {contributions.map((c) => {
                const status = c.questions?.status;
                const counts = status === 'approved' && !c.questions?.is_deleted;
                return (
                  <div key={c.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeBadge[c.contribution_type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                            {typeLabel[c.contribution_type] ?? c.contribution_type}
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
                      <div className="shrink-0">
                        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                          counts
                            ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                            : status === 'rejected'
                            ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}>
                          {counts ? 'Counts' : status === 'rejected' ? 'Rejected' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
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
