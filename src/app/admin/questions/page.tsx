'use client';

import { useEffect, useState, useCallback } from 'react';

interface Contributor {
  user_id: string;
  contribution_type: string;
  users: { full_name: string | null; email: string } | null;
}

interface Question {
  id: string;
  question_text: string;
  options: Record<string, string> | null;
  correct_answer: string | null;
  year: number | null;
  status: string;
  created_at: string;
  courses: { name: string; school: string; department: string } | null;
  question_contributions: Contributor[];
}

interface AdminComment {
  id: string;
  body: string;
  is_anonymous: boolean;
  is_hidden: boolean;
  created_at: string;
  users: { full_name: string | null; email: string } | null;
}

interface QuestionFlag {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  users: { full_name: string | null; email: string } | null;
}

const FLAG_REASON_LABEL: Record<string, string> = {
  incorrect_answer: 'Incorrect answer',
  duplicate: 'Duplicate',
  offensive: 'Offensive',
  wrong_course: 'Wrong course',
  typo: 'Typo / formatting',
  other: 'Other',
};

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, AdminComment[]>>({});
  const [flags, setFlags] = useState<Record<string, QuestionFlag[]>>({});
  const [extrasLoading, setExtrasLoading] = useState<string | null>(null);

  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/questions?status=${statusFilter}&page=${page}&limit=${limit}`);
      const json = await res.json();
      setQuestions(json.data ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  async function moderate(id: string, status: 'approved' | 'rejected', reason?: string) {
    setActionLoading(id);
    try {
      await fetch(`/api/admin/questions/${id}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
      });
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      setTotal((t) => t - 1);
    } finally {
      setActionLoading(null);
      setRejectId(null);
      setRejectReason('');
      setConfirmId(null);
    }
  }

  async function deleteQuestion(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/questions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setQuestions((prev) => prev.filter((q) => q.id !== id));
        setTotal((t) => Math.max(0, t - 1));
      }
    } finally {
      setActionLoading(null);
      setDeleteId(null);
    }
  }

  async function toggleExpanded(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!comments[id] || !flags[id]) {
      setExtrasLoading(id);
      try {
        const [cRes, fRes] = await Promise.all([
          fetch(`/api/admin/questions/${id}/comments`),
          fetch(`/api/admin/flags?question_id=${id}&limit=100`),
        ]);
        const cJson = await cRes.json();
        const fJson = await fRes.json();
        setComments((prev) => ({ ...prev, [id]: cJson.data ?? [] }));
        setFlags((prev) => ({ ...prev, [id]: fJson.data ?? [] }));
      } finally {
        setExtrasLoading(null);
      }
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Questions</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{total} {statusFilter} question{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
          {(['pending', 'approved', 'rejected'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 animate-pulse">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4 mb-3" />
              <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 dark:text-zinc-500">
          <div className="text-4xl mb-3">📭</div>
          <p className="font-medium">No {statusFilter} questions</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => {
            const isPublished = q.status === 'approved';
            return (
            <div key={q.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
              <p className="text-sm font-medium text-zinc-900 dark:text-white leading-relaxed mb-3">
                {q.question_text}
              </p>

              {q.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
                  {Object.entries(q.options).map(([key, val]) => (
                    <div
                      key={key}
                      className={`text-xs px-3 py-1.5 rounded-lg border ${
                        q.correct_answer === key
                          ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
                          : 'border-zinc-100 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      <span className="font-semibold">{key}.</span> {val}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 mb-4">
                {q.courses && (
                  <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{q.courses.name}</span>
                )}
                {q.year && <span>{q.year}</span>}
                {q.courses && <span>{q.courses.school}</span>}
                <span>{new Date(q.created_at).toLocaleDateString()}</span>
              </div>

              {q.question_contributions.length > 0 && (
                <div className="text-xs text-zinc-400 mb-4">
                  Submitted by:{' '}
                  {q.question_contributions
                    .filter((c) => c.contribution_type === 'extraction' || c.contribution_type === 'upload')
                    .map((c) => c.users?.full_name ?? c.users?.email ?? 'Unknown')
                    .join(', ')}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {statusFilter === 'pending' && (
                  <>
                    <button
                      disabled={actionLoading === q.id || isPublished}
                      onClick={() => setConfirmId(q.id)}
                      className="px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      {isPublished ? 'Published' : actionLoading === q.id ? 'Publishing…' : 'Publish'}
                    </button>
                    <button
                      disabled={actionLoading === q.id}
                      onClick={() => { setRejectId(q.id); setRejectReason(''); }}
                      className="px-4 py-1.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-60 text-xs font-medium rounded-lg transition-colors"
                    >
                      Reject
                    </button>
                  </>
                )}
                <button
                  onClick={() => toggleExpanded(q.id)}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  {expanded === q.id ? 'Hide details' : 'View comments & flags'}
                </button>
                <button
                  disabled={actionLoading === q.id}
                  onClick={() => setDeleteId(q.id)}
                  className="ml-auto px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-60 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>

              {expanded === q.id && (
                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                  {extrasLoading === q.id ? (
                    <p className="text-xs text-zinc-400">Loading…</p>
                  ) : (
                    <>
                      <div>
                        <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                          Flags ({flags[q.id]?.length ?? 0})
                        </h3>
                        {!flags[q.id] || flags[q.id].length === 0 ? (
                          <p className="text-xs text-zinc-400">No flags reported.</p>
                        ) : (
                          <ul className="space-y-2">
                            {flags[q.id].map((f) => (
                              <li key={f.id} className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                                    {FLAG_REASON_LABEL[f.reason] ?? f.reason}
                                  </span>
                                  <span className="text-zinc-400">
                                    {f.users?.full_name ?? f.users?.email ?? 'Anonymous'} · {new Date(f.created_at).toLocaleDateString()} · {f.status}
                                  </span>
                                </div>
                                {f.details && <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 whitespace-pre-line">{f.details}</p>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                          Comments ({comments[q.id]?.length ?? 0})
                        </h3>
                        {!comments[q.id] || comments[q.id].length === 0 ? (
                          <p className="text-xs text-zinc-400">No comments yet.</p>
                        ) : (
                          <ul className="space-y-2">
                            {comments[q.id].map((c) => (
                              <li key={c.id} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg px-3 py-2">
                                <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                                  <span className="font-medium">
                                    {c.is_anonymous ? '(anon) ' : ''}
                                    {c.users?.full_name ?? c.users?.email ?? 'Unknown'}
                                  </span>
                                  <span>{new Date(c.created_at).toLocaleString()}</span>
                                </div>
                                <p className="text-xs text-zinc-700 dark:text-zinc-200 whitespace-pre-line">{c.body}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            Previous
          </button>
          <span className="text-sm text-zinc-500 px-2">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            Next
          </button>
        </div>
      )}

      {/* Publish confirm modal */}
      {confirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Publish this question?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
              Once published the question will be live in the bank. You can&apos;t publish it again from this list.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmId(null)}
                className="flex-1 px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-700 dark:text-zinc-300">
                Cancel
              </button>
              <button
                disabled={actionLoading === confirmId}
                onClick={() => moderate(confirmId, 'approved')}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                {actionLoading === confirmId ? 'Publishing…' : 'Yes, publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject reason modal */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-4">Reject question</h2>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Optional reason for rejection (sent to contributor)"
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectId(null)}
                className="flex-1 px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-700 dark:text-zinc-300">
                Cancel
              </button>
              <button onClick={() => moderate(rejectId, 'rejected', rejectReason)}
                disabled={actionLoading === rejectId}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                {actionLoading === rejectId ? 'Rejecting…' : 'Confirm rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Delete this question?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
              The question will be removed from the bank. This action cannot be undone from the UI.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-700 dark:text-zinc-300">
                Cancel
              </button>
              <button onClick={() => deleteQuestion(deleteId)}
                disabled={actionLoading === deleteId}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                {actionLoading === deleteId ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
