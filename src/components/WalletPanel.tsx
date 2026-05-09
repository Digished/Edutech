'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRightIcon,
  CheckIcon,
  LockIcon,
  SparklesIcon,
  WalletIcon,
  XIcon,
} from '@/components/icons';
import SearchSelect from '@/components/SearchSelect';

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

interface PayoutMethod {
  id: string;
  bank_code: string;
  bank_name: string | null;
  account_number: string;
  account_name: string;
  is_default: boolean;
}

interface Props {
  isContributor: boolean;
  approvedContributions: number;
  promotionThreshold: number;
}

export default function WalletPanel({ isContributor, approvedContributions, promotionThreshold }: Props) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // Withdraw form state
  const [methodId, setMethodId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [resolveStatus, setResolveStatus] = useState<'idle' | 'resolving' | 'ok' | 'error'>('idle');
  const [resolveError, setResolveError] = useState('');
  const [resolvedName, setResolvedName] = useState('');

  useEffect(() => {
    if (!isContributor) { setLoading(false); return; }
    async function load() {
      try {
        const [w, m, b] = await Promise.all([
          fetch('/api/wallet?page=1&limit=10'),
          fetch('/api/payout-methods'),
          fetch('/api/wallet/banks'),
        ]);
        if (w.ok) {
          const j = await w.json();
          setWallet(j.data);
        }
        if (m.ok) {
          const j = await m.json();
          const list = (j.data ?? []) as PayoutMethod[];
          setMethods(list);
          const def = list.find((x) => x.is_default) ?? list[0];
          if (def) setMethodId(def.id);
        }
        if (b.ok) {
          const j = await b.json();
          setBanks(j.data ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isContributor]);

  // Auto-resolve account name when adding a new bank.
  useEffect(() => {
    if (methodId !== '__new__') { setResolveStatus('idle'); setResolvedName(''); return; }
    if (!bankCode || !/^\d{10}$/.test(accountNumber)) {
      setResolveStatus('idle'); setResolvedName(''); return;
    }
    let cancelled = false;
    setResolveStatus('resolving');
    setResolveError('');
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/wallet/resolve-account', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bank_code: bankCode, account_number: accountNumber }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setResolveStatus('error');
          setResolveError(json.error ?? 'Could not verify');
          setResolvedName('');
          return;
        }
        setResolveStatus('ok');
        setResolvedName(json.data.account_name);
      } catch {
        if (!cancelled) { setResolveStatus('error'); setResolveError('Network error'); }
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [methodId, bankCode, accountNumber]);

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setWithdrawError('');
    setWithdrawLoading(true);
    try {
      const payload: Record<string, unknown> = { amount: Number(amount) };
      if (methodId === '__new__') {
        if (resolveStatus !== 'ok') {
          setWithdrawError('Verify the bank account first');
          return;
        }
        payload.bank_code = bankCode;
        payload.bank_account_number = accountNumber;
        payload.bank_name = banks.find((b) => b.code === bankCode)?.name ?? null;
        payload.save_method = true;
      } else {
        payload.payout_method_id = methodId;
      }

      const res = await fetch('/api/withdrawals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setWithdrawError(json.error ?? 'Withdrawal failed');
        return;
      }
      setWithdrawSuccess(true);
      setShowWithdraw(false);
      setAmount(''); setBankCode(''); setAccountNumber('');
      // Reload wallet + methods.
      const [w, m] = await Promise.all([fetch('/api/wallet?page=1&limit=10'), fetch('/api/payout-methods')]);
      if (w.ok) { const j = await w.json(); setWallet(j.data); }
      if (m.ok) { const j = await m.json(); setMethods(j.data ?? []); const def = (j.data ?? []).find((x: PayoutMethod) => x.is_default) ?? (j.data ?? [])[0]; if (def) setMethodId(def.id); }
    } finally {
      setWithdrawLoading(false);
    }
  }

  async function deleteMethod(id: string) {
    const res = await fetch(`/api/payout-methods?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMethods((prev) => prev.filter((m) => m.id !== id));
      if (methodId === id) setMethodId(methods.find((m) => m.id !== id)?.id ?? '__new__');
    }
  }

  if (!isContributor) {
    const pct = Math.min(100, Math.round((approvedContributions / promotionThreshold) * 100));
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center shrink-0">
            <LockIcon size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-zinc-900 dark:text-white">Wallet locked</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Reach <strong>{promotionThreshold} approved contributions</strong> to unlock your wallet, save payout details once, and withdraw earnings to any Nigerian bank.
            </p>
            <div className="mt-3">
              <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div className="h-full bg-green-600 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                {approvedContributions} / {promotionThreshold} approved
              </div>
            </div>
            <ul className="mt-4 text-xs text-zinc-600 dark:text-zinc-300 space-y-1.5">
              <li className="flex items-center gap-2"><SparklesIcon size={12} className="text-green-600" /> Earn a share of the monthly revenue pool</li>
              <li className="flex items-center gap-2"><SparklesIcon size={12} className="text-green-600" /> Withdraw to any Nigerian bank via Paystack</li>
              <li className="flex items-center gap-2"><SparklesIcon size={12} className="text-green-600" /> Save your payout details once — no re-entering each time</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 flex items-center justify-center">
            <WalletIcon size={18} />
          </span>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-zinc-400">Wallet balance</div>
            <div className="text-2xl font-semibold text-zinc-900 dark:text-white">
              ₦{(wallet?.balance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        <button
          onClick={() => { setShowWithdraw(true); setWithdrawSuccess(false); setWithdrawError(''); }}
          disabled={loading || (wallet?.balance ?? 0) < 1000}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Withdraw
        </button>
      </div>

      {withdrawSuccess && (
        <div className="mt-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm px-3 py-2 rounded-lg">
          Withdrawal initiated. Funds arrive in 1–2 business days.
        </div>
      )}

      {methods.length > 0 && (
        <div className="mt-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Saved payout methods</div>
          <div className="space-y-2">
            {methods.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-900 dark:text-white truncate">{m.account_name}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {m.bank_name ?? m.bank_code} · {m.account_number.replace(/.(?=.{4})/g, '•')}
                    {m.is_default && <span className="ml-2 text-[10px] uppercase tracking-wide text-green-600">Default</span>}
                  </div>
                </div>
                <button onClick={() => deleteMethod(m.id)} className="text-xs text-zinc-400 hover:text-red-500">Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {wallet && wallet.ledger.data.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Recent transactions</div>
            <a href="/dashboard/contributions#wallet" className="text-xs text-green-600 hover:text-green-700 inline-flex items-center gap-1">
              View all <ArrowRightIcon size={12} />
            </a>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-lg">
            {wallet.ledger.data.slice(0, 5).map((entry) => (
              <div key={entry.id} className="px-3 py-2 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm text-zinc-900 dark:text-white capitalize truncate">{entry.reason.replace(/_/g, ' ')}</div>
                  <div className="text-[11px] text-zinc-400">{new Date(entry.created_at).toLocaleDateString('en-NG')}</div>
                </div>
                <div className={`text-sm font-semibold ${entry.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                  {entry.type === 'credit' ? '+' : '-'}₦{Number(entry.amount).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showWithdraw && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-zinc-900 dark:text-white">Withdraw funds</h3>
              <button onClick={() => setShowWithdraw(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleWithdraw} className="space-y-4">
              {withdrawError && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg">
                  {withdrawError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Amount (₦)</label>
                <input
                  type="number" required min={1000} max={wallet?.balance}
                  value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000"
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Pay to</label>
                <select
                  value={methodId}
                  onChange={(e) => setMethodId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {methods.map((m) => (
                    <option key={m.id} value={m.id}>{m.account_name} · {m.bank_name ?? m.bank_code} · {m.account_number.slice(-4)}</option>
                  ))}
                  <option value="__new__">Add a new bank account…</option>
                </select>
              </div>

              {methodId === '__new__' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Bank</label>
                    <SearchSelect
                      options={banks.map((b) => ({ value: b.code, label: b.name }))}
                      value={bankCode}
                      onChange={(v) => { setBankCode(v); setResolvedName(''); }}
                      placeholder="Search banks…"
                      emptyText="No matching banks"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Account number</label>
                    <input
                      type="text" inputMode="numeric" pattern="[0-9]{10}" maxLength={10}
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit account number"
                      className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                    resolveStatus === 'ok'
                      ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40 text-green-800 dark:text-green-300'
                      : resolveStatus === 'error'
                      ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                      : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                  }`}>
                    {resolveStatus === 'resolving' && <span className="inline-block w-3 h-3 border-2 border-zinc-300 border-t-green-600 rounded-full animate-spin" />}
                    {resolveStatus === 'ok' && <CheckIcon size={14} />}
                    {resolveStatus === 'error' && <XIcon size={14} />}
                    <span className="truncate">
                      {resolveStatus === 'ok' && (resolvedName || 'Verified')}
                      {resolveStatus === 'resolving' && 'Looking up account…'}
                      {resolveStatus === 'error' && (resolveError || 'Could not verify')}
                      {resolveStatus === 'idle' && 'Enter bank and 10-digit account number'}
                    </span>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowWithdraw(false)} className="flex-1 px-4 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={withdrawLoading || (methodId === '__new__' && resolveStatus !== 'ok')}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-lg"
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
