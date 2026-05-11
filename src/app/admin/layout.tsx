'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brand } from '@/components/Logo';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    // Skip auth check on the login page itself
    if (pathname === '/admin/login') { setChecking(false); return; }
    fetch('/api/auth/me').then(async (res) => {
      if (!res.ok) { window.location.href = '/admin/login'; return; }
      const json = await res.json();
      if (json.data?.role !== 'admin') { window.location.href = '/admin/login'; return; }
      setChecking(false);
    }).catch(() => { window.location.href = '/admin/login'; });
  }, [pathname]);

  if (checking) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-sm">Checking access…</div>
      </div>
    );
  }

  const nav = [
    { href: '/admin/questions', label: 'Questions' },
    { href: '/admin/withdrawals', label: 'Payouts' },
    { href: '/admin/subscriptions', label: 'Subscriptions' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/universities', label: 'Universities' },
    { href: '/admin/faculties', label: 'Faculties' },
    { href: '/admin/departments', label: 'Departments' },
    { href: '/admin/courses', label: 'Courses' },
    { href: '/admin/settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="h-14 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Brand size="sm" href="/" />
              <span className="text-[10px] sm:text-xs bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 px-2 py-0.5 rounded font-medium uppercase tracking-wide">Admin</span>
            </div>
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </div>
          <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-1 py-2 min-w-max">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                    pathname.startsWith(n.href)
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                  }`}
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
