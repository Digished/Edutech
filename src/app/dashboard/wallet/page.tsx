'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface LedgerEntry {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  status: string;
  reason: string;
  created_at: string;
}

interface WalletData {
  balance: number;
  currency: string;
  ledger: { data: LedgerEntry[]; total: number };
}

interface Bank {
  id: number;
  name: string;
  code: string;
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', bank_code: '', account_number: '', account_name: '' });
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const limit = 20;

  useEffect(() => {
    async function load() {
      try {
        const [walletRes, banksRes] = await Promise.all([
          fetch(`/api/wallet?page=${page}&limit=${limit}`),
          fetch('/api/wallet/banks'),
        ]);

        if (!walletRes.ok) {
          window.location.href = '/login';
          return;
        }

        const w = await walletRes.json();
        setWallet(w.data);

        if (banksRes.ok) {
          const b = await banksRes.json();
          setBanks(b.data ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page]);

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setWithdrawError('');
    setWithdrawLoading(true);
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(withdrawForm.amount),
          bank_code: withdrawForm.bank_code,
          account_number: withdrawForm.account_number,
          account_name: withdrawForm.account_name,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setWithdrawError(json.error ?? 'Withdrawal failed');
        return;
      }
      setWithdrawSuccess(true);
      setShowWithdraw(false);
      setWithdrawForm({ amount: '', bank_code: '', account_number: '', account_name: '' });
      const updated = await fetch(`/api/wallet?page=1&limit=${limit}`);
      if (updated.ok) {
        const w = await updated.json();
        setWallet(w.data);
        setPage(1);
      }
    } finally {
      setWithdrawLoading(false);
    }
  }

  const totalPages = wallet ? Math.ceil(wallet.ledger.total / limit) : 1;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
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
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Wallet</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Your earnings and transactions</p>
          </div>
          {!loading && wallet && (
            <button
              onClick={() => { setShowWithdraw(true); setWithdrawSuccess(false); setWithdrawError(''); }}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Withdraw
            </button>
          )}
        </div>

        {withdrawSuccess && (
          <div className="mb-6 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm px-4 py-3 rounded-lg">
            Withdrawal initiated. Funds will arrive within 1-2 business days.
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="h-28 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 animate-pulse" />
            <div className="h-64 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 animate-pulse" />
          </div>
        ) : wallet ? (
          <>
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
              <div className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Available Balance</div>
              <div className="text-3xl font-bold text-zinc-900 dark:text-white">
                ₦{wallet.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-zinc-400 mt-1">{wallet.ledger.total} total transactions</div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
                <h2 className="font-semibold text-zinc-900 dark:text-white text-sm">Transaction history</h2>
              </div>
              {wallet.ledger.data.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
                  <div className="text-3xl mb-2">💳</div>
                  <p className="text-sm">No transactions yet</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
                  {wallet.ledger.data.map((entry) => (
                    <div key={entry.id} className="px-5 py-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-zinc-900 dark:text-white capitalize font-medium">
                          {entry.reason.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-2">
                          <span>{new Date(entry.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            entry.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' :
                            entry.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400' :
                            'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                          }`}>
                            {entry.status}
                          </span>
                        </div>
                      </div>
                      <div className={`text-sm font-bold ${entry.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                        {entry.type === 'credit' ? '+' : '-'}₦{Number(entry.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
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
                  <span className="text-xs text-zinc-400">Page {page} of {totalPages}</span>
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
          </>
        ) : null}
      </div>

      {showWithdraw && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-zinc-900 dark:text-white">Withdraw funds</h2>
              <button onClick={() => setShowWithdraw(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>

            <form onSubmit={handleWithdraw} className="space-y-4">
              {withdrawError && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
                  {withdrawError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Amount (₦) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={100}
                  max={wallet?.balance}
                  value={withdrawForm.amount}
                  onChange={(e) => setWithdrawForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Bank <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={withdrawForm.bank_code}
                  onChange={(e) => setWithdrawForm((f) => ({ ...f, bank_code: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select a bank…</option>
                  {banks.map((b) => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Account number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={withdrawForm.account_number}
                  onChange={(e) => setWithdrawForm((f) => ({ ...f, account_number: e.target.value }))}
                  placeholder="10-digit account number"
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Account name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={withdrawForm.account_name}
                  onChange={(e) => setWithdrawForm((f) => ({ ...f, account_name: e.target.value }))}
                  placeholder="As it appears on the account"
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowWithdraw(false)}
                  className="flex-1 px-4 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={withdrawLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  {withdrawLoading ? 'Processing…' : 'Withdraw'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
