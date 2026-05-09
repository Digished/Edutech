'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckIcon, XIcon, InboxIcon, ClockIcon } from '@/components/icons';

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  bank_code: string;
  bank_account_number: string;
  account_name: string | null;
  status: 'pending' | 'processing' | 'successful' | 'failed';
  paystack_transfer_code: string | null;
  failure_reason: string | null;
  created_at: string;
  users: { full_name: string | null; email: string } | null;
}

const STATUSES = ['pending', 'processing', 'successful', 'failed'] as const;

const STATUS_CHIP: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  successful: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
};

export default function AdminWithdrawalsPage() {
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [failModal, setFailModal] = useState<{ id: string; amount: number } | null>(null);
  const [failReason, setFailReason] = useState('');

  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/withdrawals?${params}`);
      const json = await res.json();
      setItems(json.data ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, status: 'successful' | 'failed' | 'processing', failure_reason?: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, failure_reason: failure_reason ?? null }),
      });
      if (res.ok) await load();
    } finally {
      setActionLoading(null);
      setFailModal(null);
      setFailReason('');
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Payout requests</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {total} {statusFilter || 'total'} request{total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
          {STATUSES.map((s) => (
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
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-2/3 mb-2" />
              <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 dark:text-zinc-500">
          <InboxIcon size={36} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
          <p className="font-medium">No {statusFilter} payout requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((w) => (
            <div key={w.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                      ₦{Number(w.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_CHIP[w.status]}`}>
                      {w.status}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-700 dark:text-zinc-300">
                    {w.users?.full_name ?? w.users?.email ?? 'Unknown user'}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-3 flex-wrap">
                    <span>{w.account_name ?? '—'}</span>
                    <span>·</span>
                    <span>{w.bank_account_number}</span>
                    <span>·</span>
                    <span className="font-mono">bank {w.bank_code}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1"><ClockIcon size={11} /> {new Date(w.created_at).toLocaleString()}</span>
                  </div>
                  {w.paystack_transfer_code && (
                    <div className="text-xs text-zinc-400 mt-1 font-mono">paystack ref: {w.paystack_transfer_code}</div>
                  )}
                  {w.failure_reason && (
                    <div className="text-xs text-red-600 dark:text-red-400 mt-1">Failed: {w.failure_reason}</div>
                  )}
                </div>

                {(w.status === 'pending' || w.status === 'processing') && (
                  <div className="flex items-center gap-2 shrink-0">
                    {w.status === 'pending' && (
                      <button
                        disabled={actionLoading === w.id}
                        onClick={() => setStatus(w.id, 'processing')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 disabled:opacity-60 text-xs font-medium rounded-lg"
                      >
                        Mark processing
                      </button>
                    )}
                    <button
                      disabled={actionLoading === w.id}
                      onClick={() => setStatus(w.id, 'successful')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg"
                    >
                      <CheckIcon size={12} /> Mark done
                    </button>
                    <button
                      disabled={actionLoading === w.id}
                      onClick={() => { setFailModal({ id: w.id, amount: w.amount }); setFailReason(''); }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-60 text-xs font-medium rounded-lg"
                    >
                      <XIcon size={12} /> Mark failed
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Previous
          </button>
          <span className="text-sm text-zinc-500 px-2">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Next
          </button>
        </div>
      )}

      {failModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Mark payout failed</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              The user&apos;s ₦{Number(failModal.amount).toLocaleString()} will be refunded to their wallet automatically.
            </p>
            <textarea
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="Reason (shown to the user)"
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setFailModal(null)}
                className="flex-1 px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                Cancel
              </button>
              <button onClick={() => setStatus(failModal.id, 'failed', failReason || undefined)}
                disabled={actionLoading === failModal.id}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg">
                {actionLoading === failModal.id ? 'Saving…' : 'Confirm failure'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
