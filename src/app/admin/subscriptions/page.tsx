'use client';

import { useEffect, useState, useCallback } from 'react';

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: 'monthly' | 'quarterly' | 'yearly';
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  amount: number | string;
  currency: string;
  reference: string | null;
  starts_at: string | null;
  ends_at: string | null;
  school: string | null;
  faculty: string | null;
  department: string | null;
  created_at: string;
  users: {
    id: string;
    full_name: string | null;
    email: string;
    school: string | null;
    role: 'student' | 'contributor' | 'admin';
  } | null;
}

interface Totals {
  lifetime_revenue: number;
  this_month_revenue: number;
  currency: string;
  active_count: number;
  pending_count: number;
  expired_count: number;
  cancelled_count: number;
}

const statusBadge: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  expired: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export default function AdminSubscriptionsPage() {
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set('status', statusFilter);
      if (planFilter) params.set('plan', planFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/subscriptions?${params}`);
      const json = await res.json();
      setRows(json.data?.data ?? []);
      setTotal(json.data?.total ?? 0);
      setTotals(json.data?.totals ?? null);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, planFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Subscriptions</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {total.toLocaleString()} subscription{total === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Revenue summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Lifetime revenue</div>
          <div className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">
            {totals ? formatMoney(totals.lifetime_revenue, totals.currency) : '—'}
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">This month</div>
          <div className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">
            {totals ? formatMoney(totals.this_month_revenue, totals.currency) : '—'}
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Active subscribers</div>
          <div className="mt-1 text-xl font-bold text-green-700 dark:text-green-400">
            {totals?.active_count.toLocaleString() ?? '—'}
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Pending / expired</div>
          <div className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">
            {totals
              ? `${totals.pending_count.toLocaleString()} / ${totals.expired_count.toLocaleString()}`
              : '—'}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 mb-6 flex flex-wrap gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput);
            setPage(1);
          }}
          className="flex gap-2 flex-1 min-w-48"
        >
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, email, school…"
            className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
          >
            Filter
          </button>
        </form>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All plans</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="space-y-px">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 bg-zinc-50 dark:bg-zinc-800/50 animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
            <p className="text-sm">No subscriptions found</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
            {rows.map((r) => {
              const u = r.users;
              const amount = Number(r.amount) || 0;
              return (
                <div key={r.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                        {u?.full_name ?? u?.email ?? 'Unknown user'}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${statusBadge[r.status] ?? statusBadge.pending}`}
                      >
                        {r.status}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {r.plan}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      {u?.email && <span>{u.email}</span>}
                      {(r.school || u?.school) && <span>· {r.school ?? u?.school}</span>}
                      {r.faculty && <span>· {r.faculty}</span>}
                      {r.department && <span>· {r.department}</span>}
                      <span>· Started {new Date(r.created_at).toLocaleDateString()}</span>
                      {r.ends_at && (
                        <span>
                          · {new Date(r.ends_at) > new Date() ? 'Ends' : 'Ended'}{' '}
                          {new Date(r.ends_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {formatMoney(amount, r.currency || 'NGN')}
                    </div>
                    {r.reference && (
                      <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{r.reference}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-zinc-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
