'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/auth/me').then(async (res) => {
      if (!res.ok) { window.location.href = '/login'; return; }
      const json = await res.json();
      if (json.data?.role !== 'admin') { window.location.href = '/dashboard'; return; }
      setChecking(false);
    }).catch(() => { window.location.href = '/login'; });
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-sm">Checking access…</div>
      </div>
    );
  }

  const nav = [
    { href: '/admin/questions', label: 'Questions' },
    { href: '/admin/users', label: 'Users' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center">
                <span className="text-white font-bold text-xs">E</span>
              </div>
              <span className="font-semibold text-zinc-900 dark:text-white">EduTech</span>
            </Link>
            <span className="text-xs bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 px-2 py-0.5 rounded font-medium">Admin</span>
            <div className="flex items-center gap-1">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
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
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors">
            ← Dashboard
          </Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
