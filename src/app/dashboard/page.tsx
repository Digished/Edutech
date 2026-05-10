'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BookIcon,
  ClockIcon,
  FlaskIcon,
  GraduationIcon,
  LockIcon,
  LogOutIcon,
  PenIcon,
  PlayIcon,
  SparklesIcon,
} from '@/components/icons';
import { Brand } from '@/components/Logo';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  school: string | null;
  department: string | null;
  role: 'student' | 'contributor' | 'admin';
}

interface UnlockedFaculty {
  faculty_id: string;
  school: string | null;
  faculty: string | null;
  plan: 'monthly' | 'quarterly' | 'yearly';
  ends_at: string | null;
}

interface ContributorStatus {
  role: 'student' | 'contributor' | 'admin';
  is_admin: boolean;
  is_contributor: boolean;
  has_full_access: boolean;
  approved_contributions: number;
  promotion_threshold: number;
  progress_to_contributor: number;
  unlocked_faculties: UnlockedFaculty[];
}

interface PausedSession {
  ids: string[];
  answers: Record<string, string>;
  startedAt: number;
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<ContributorStatus | null>(null);
  const [contributions, setContributions] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paused, setPaused] = useState<{ progress: number; total: number } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [meRes, statusRes, contribRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/contributor-status'),
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

        if (statusRes.ok) {
          const j = await statusRes.json();
          setStatus(j.data);
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
  const isAdmin = status?.is_admin ?? false;
  const isContributor = status?.is_contributor ?? false;
  const unlocked = status?.unlocked_faculties ?? [];
  const accessUnlocked = isAdmin || unlocked.length > 0;
  const promoPct = status
    ? Math.min(100, Math.round((status.approved_contributions / status.promotion_threshold) * 100))
    : 0;

  const actions = [
    {
      label: accessUnlocked ? 'Browse questions' : 'Subscribe to browse',
      href: accessUnlocked ? '/questions' : '/dashboard/subscription',
      desc: accessUnlocked ? 'Search your unlocked faculties' : 'Unlock a faculty to browse',
      Icon: BookIcon,
    },
    { label: 'Practice exam', href: '/dashboard/practice', desc: 'Sit a mock exam', Icon: FlaskIcon },
    { label: 'Practice history', href: '/dashboard/practice/history', desc: 'Review past exams', Icon: ClockIcon },
    { label: 'Contributions', href: '/dashboard/contributions', desc: 'Add questions & manage wallet', Icon: PenIcon },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Nav — logo points to /dashboard so logged-in users stay logged in. */}
      <nav className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Brand size="sm" href="/dashboard" />
          <div className="flex items-center gap-3 min-w-0">
            <span className="hidden sm:inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium ${
                  isAdmin
                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                    : isContributor
                    ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
                }`}
              >
                <GraduationIcon size={12} />
                {isAdmin ? 'Admin' : isContributor ? 'Contributor' : 'Student'}
              </span>
              {!isAdmin && unlocked.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 font-medium">
                  <SparklesIcon size={12} />
                  {unlocked.length} unlocked
                </span>
              )}
              <span className="text-zinc-400 truncate max-w-[12rem]">{user.email}</span>
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
            Hello, {firstName}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {isAdmin
              ? 'Admin · full access'
              : unlocked.length === 0
              ? 'No faculties unlocked yet'
              : `${unlocked.length} ${unlocked.length === 1 ? 'faculty' : 'faculties'} unlocked`}
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

        {/* Status strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {/* Subscriptions tile — always points at the subscription page */}
          <Link
            href="/dashboard/subscription"
            className="group bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 hover:border-green-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-zinc-400">Subscriptions</div>
                <div className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white mt-0.5">
                  {isAdmin
                    ? 'Full access'
                    : unlocked.length === 0
                    ? 'No faculties unlocked'
                    : `${unlocked.length} ${unlocked.length === 1 ? 'faculty' : 'faculties'} unlocked`}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {isAdmin ? 'Manage subscriptions' : 'Manage or add faculties'}
                </div>
              </div>
              <span
                className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                  accessUnlocked
                    ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 group-hover:bg-green-50 group-hover:text-green-700'
                }`}
              >
                {accessUnlocked ? <SparklesIcon size={16} /> : <LockIcon size={16} />}
              </span>
            </div>
            {!isAdmin && unlocked.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {unlocked.slice(0, 4).map((d) => (
                  <span
                    key={d.faculty_id}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  >
                    {d.faculty ?? 'Faculty'}
                  </span>
                ))}
                {unlocked.length > 4 && (
                  <span className="text-[10px] text-zinc-400">+{unlocked.length - 4} more</span>
                )}
              </div>
            )}
          </Link>

          {/* Contributions tile with progress */}
          <Link
            href="/dashboard/contributions"
            className="group bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 hover:border-green-300 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-zinc-400">Contributions</div>
                <div className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white mt-0.5">
                  {contributions} total
                </div>
                {!isContributor && status && (
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    {status.approved_contributions} / {status.promotion_threshold} approved → contributor
                  </div>
                )}
                {isContributor && (
                  <div className="text-[11px] text-green-600 dark:text-green-400 mt-0.5">Wallet unlocked</div>
                )}
              </div>
              <span className="w-9 h-9 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center group-hover:bg-green-50 group-hover:text-green-700 transition-colors">
                <PenIcon size={16} />
              </span>
            </div>
            {!isContributor && (
              <div className="mt-3 h-1 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div className="h-full bg-green-600 transition-all" style={{ width: `${promoPct}%` }} />
              </div>
            )}
          </Link>
        </div>

        {/* Quick actions */}
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
      </div>
    </div>
  );
}
