'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  school: string | null;
  department: string | null;
  role: string;
}

interface WalletData {
  balance: number;
  currency: string;
  ledger: { data: LedgerEntry[]; total: number };
}

interface LedgerEntry {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  status: string;
  reason: string;
  created_at: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [contributions, setContributions] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [meRes, walletRes, contribRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/wallet'),
          fetch('/api/contributions?limit=1'),
        ]);

        if (!meRes.ok) {
          window.location.href = '/login';
          return;
        }

        const meJson = await meRes.json();
        setUser(meJson.data);

        if (walletRes.ok) {
          const w = await walletRes.json();
          setWallet(w.data);
        }

        if (contribRes.ok) {
          const c = await contribRes.json();
          setContributions(c.total ?? 0);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Nav */}
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">E</span>
            </div>
            <span className="font-semibold text-zinc-900 dark:text-white">EduTech</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500 dark:text-zinc-400 hidden sm:block">{user.email}</span>
            <button onClick={handleLogout} className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors">
              Log out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Hello, {user.full_name?.split(' ')[0] ?? 'there'} 👋
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {user.school ?? 'No university set'} {user.department ? `· ${user.department}` : ''} ·{' '}
            <span className="capitalize bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 px-2 py-0.5 rounded text-xs font-medium">
              {user.role}
            </span>
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
            <div className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Wallet Balance</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">
              ₦{(wallet?.balance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </div>
            <Link href="/dashboard/wallet" className="text-xs text-green-600 hover:text-green-700 mt-1 inline-block">
              View transactions →
            </Link>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
            <div className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Contributions</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{contributions}</div>
            <Link href="/dashboard/contributions" className="text-xs text-green-600 hover:text-green-700 mt-1 inline-block">
              View history →
            </Link>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
            <div className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Role</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white capitalize">{user.role}</div>
            <span className="text-xs text-zinc-400 mt-1 inline-block">
              {user.role === 'student' ? 'Submit a question to become a contributor' : 'Keep contributing to earn more'}
            </span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Browse questions', href: '/questions', icon: '📚', desc: 'Search the question bank' },
            { label: 'Upload paper', href: '/dashboard/uploads', icon: '📤', desc: 'Upload a past question PDF' },
            { label: 'My wallet', href: '/dashboard/wallet', icon: '💰', desc: 'View balance & withdraw' },
            { label: 'Contributions', href: '/dashboard/contributions', icon: '✍️', desc: 'See what you\'ve added' },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 hover:border-green-200 dark:hover:border-green-800 transition-colors group"
            >
              <div className="text-2xl mb-2">{action.icon}</div>
              <div className="font-medium text-zinc-900 dark:text-white text-sm group-hover:text-green-600 transition-colors">
                {action.label}
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">{action.desc}</div>
            </Link>
          ))}
        </div>

        {/* Recent transactions */}
        {wallet && wallet.ledger.data.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-900 dark:text-white text-sm">Recent transactions</h2>
              <Link href="/dashboard/wallet" className="text-xs text-green-600 hover:text-green-700">View all</Link>
            </div>
            <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {wallet.ledger.data.slice(0, 5).map((entry) => (
                <div key={entry.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-zinc-900 dark:text-white capitalize">{entry.reason.replace('_', ' ')}</div>
                    <div className="text-xs text-zinc-400">{new Date(entry.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className={`text-sm font-semibold ${entry.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                    {entry.type === 'credit' ? '+' : '-'}₦{Number(entry.amount).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
