'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BookIcon,
  FlaskIcon,
  GraduationIcon,
  LogOutIcon,
  PenIcon,
  PlayIcon,
  WalletIcon,
} from '@/components/icons';

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

interface PausedSession {
  ids: string[];
  answers: Record<string, string>;
  startedAt: number;
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [contributions, setContributions] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paused, setPaused] = useState<{ progress: number; total: number } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [meRes, walletRes, contribRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/wallet'),
          fetch('/api/contributions?limit=1'),
        ]);

        if (meRes.status === 401) { window.location.href = '/login'; return; }
        if (!meRes.ok) {
          setError('Could not load your profile. Please check your Supabase database setup.');
          setLoading(false);
          return;
        }

        const meJson = await meRes.json();
        if (!meJson.data) {
          setError('Profile not found. Your account may not be fully set up.');
          setLoading(false);
          return;
        }
        setUser(meJson.data);

        if (walletRes.ok) {
          const w = await walletRes.json();
          setWallet(w.data);
        }
        if (contribRes.ok) {
          const c = await contribRes.json();
          setContributions(c.total ?? 0);
        }

        const raw = sessionStorage.getItem('practice_session');
        if (raw) {
          try {
            const s = JSON.parse(raw) as PausedSession;
            const answered = Object.values(s.answers ?? {}).filter((v) => v && v.trim()).length;
            if (s.ids?.length) setPaused({ progress: answered, total: s.ids.length });
          } catch { /* ignore */ }
        }

        setLoading(false);
      } catch {
        setError('Something went wrong loading your dashboard.');
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

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <AlertTriangleIcon size={28} className="mx-auto text-amber-500 mb-3" />
          <p className="font-medium text-zinc-900 dark:text-white mb-1">Dashboard unavailable</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 text-sm text-green-600 hover:text-green-700">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const firstName = user.full_name?.split(' ')[0] ?? 'there';
  const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);

  const actions = [
    { label: 'Browse questions', href: '/questions', desc: 'Search the bank', Icon: BookIcon },
    { label: 'Practice exam', href: '/dashboard/practice', desc: 'Sit a mock exam', Icon: FlaskIcon },
    { label: 'Contributions', href: '/dashboard/contributions', desc: 'Submit & track', Icon: PenIcon },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Nav */}
      <nav className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">E</span>
            </div>
            <span className="font-semibold text-zinc-900 dark:text-white">EduTech</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 font-medium">
                <GraduationIcon size={12} />
                {roleLabel}
              </span>
              <span className="text-zinc-400">{user.email}</span>
            </span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
            >
              <LogOutIcon size={14} /> Log out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Greeting + meta strip — single compact line, no role repetition */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
            Hello, {firstName}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {user.school ?? 'No university set'}{user.department ? ` · ${user.department}` : ''}
          </p>
        </div>

        {/* Resume practice banner */}
        {paused && (
          <Link
            href="/dashboard/practice/run"
            className="group flex items-center justify-between gap-3 mb-6 px-4 py-3 rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/40 dark:border-green-900 hover:border-green-300"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-green-600 text-white flex items-center justify-center">
                <PlayIcon size={16} />
              </span>
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-white">Resume your practice exam</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {paused.progress} of {paused.total} answered · paused
                </div>
              </div>
            </div>
            <ArrowRightIcon size={16} className="text-green-700 dark:text-green-400 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}

        {/* Compact metric strip — two metrics, no repetition */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link
            href="/dashboard/wallet"
            className="group bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between hover:border-green-300 transition-colors"
          >
            <div>
              <div className="text-[11px] uppercase tracking-wide text-zinc-400">Wallet</div>
              <div className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-white mt-0.5">
                ₦{(wallet?.balance ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <span className="w-9 h-9 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center group-hover:bg-green-50 group-hover:text-green-700 dark:group-hover:bg-green-950 dark:group-hover:text-green-400 transition-colors">
              <WalletIcon size={16} />
            </span>
          </Link>
          <Link
            href="/dashboard/contributions"
            className="group bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between hover:border-green-300 transition-colors"
          >
            <div>
              <div className="text-[11px] uppercase tracking-wide text-zinc-400">Contributions</div>
              <div className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-white mt-0.5">{contributions}</div>
            </div>
            <span className="w-9 h-9 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center group-hover:bg-green-50 group-hover:text-green-700 dark:group-hover:bg-green-950 dark:group-hover:text-green-400 transition-colors">
              <PenIcon size={16} />
            </span>
          </Link>
        </div>

        {/* Quick actions — denser grid with icons */}
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Quick actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {actions.map(({ label, href, desc, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 hover:border-green-300 dark:hover:border-green-800 transition-colors"
            >
              <span className="inline-flex w-8 h-8 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 items-center justify-center mb-2 group-hover:bg-green-50 group-hover:text-green-700 dark:group-hover:bg-green-950 dark:group-hover:text-green-400 transition-colors">
                <Icon size={16} />
              </span>
              <div className="text-sm font-medium text-zinc-900 dark:text-white group-hover:text-green-600 transition-colors">
                {label}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">{desc}</div>
            </Link>
          ))}
        </div>

        {/* Recent transactions */}
        {wallet && wallet.ledger.data.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-900 dark:text-white text-sm">Recent transactions</h2>
              <Link href="/dashboard/wallet" className="text-xs text-green-600 hover:text-green-700 inline-flex items-center gap-1">
                View all <ArrowRightIcon size={12} />
              </Link>
            </div>
            <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {wallet.ledger.data.slice(0, 5).map((entry) => (
                <div key={entry.id} className="px-4 py-2.5 flex items-center justify-between">
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
