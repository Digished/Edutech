'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeftIcon, CheckIcon, XIcon } from '@/components/icons';

type State =
  | { kind: 'verifying' }
  | { kind: 'ok'; endsAt: string | null; plan: string }
  | { kind: 'error'; message: string };

function VerifyInner() {
  const params = useSearchParams();
  const reference = params.get('reference') ?? params.get('trxref');
  const [state, setState] = useState<State>({ kind: 'verifying' });

  useEffect(() => {
    if (!reference) {
      setState({ kind: 'error', message: 'No reference in URL' });
      return;
    }
    fetch('/api/subscriptions/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference }),
    }).then(async (r) => {
      const j = await r.json();
      if (!r.ok) {
        setState({ kind: 'error', message: j.error ?? 'Verification failed' });
        return;
      }
      setState({ kind: 'ok', endsAt: j.data.ends_at, plan: j.data.plan });
    }).catch(() => setState({ kind: 'error', message: 'Network error' }));
  }, [reference]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
            <span className="inline-flex items-center gap-1.5"><ArrowLeftIcon size={14} /> Dashboard</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-md mx-auto px-6 py-12">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-center">
          {state.kind === 'verifying' && (
            <>
              <div className="inline-block w-10 h-10 border-2 border-zinc-200 border-t-green-600 dark:border-zinc-700 dark:border-t-green-500 rounded-full animate-spin mb-3" />
              <h1 className="font-semibold text-zinc-900 dark:text-white">Confirming your payment…</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">This usually takes a few seconds.</p>
            </>
          )}
          {state.kind === 'ok' && (
            <>
              <span className="inline-flex w-12 h-12 rounded-full bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 items-center justify-center mb-3">
                <CheckIcon size={22} />
              </span>
              <h1 className="font-semibold text-zinc-900 dark:text-white">Subscription active</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Your <span className="font-medium">{state.plan}</span> plan{' '}
                {state.endsAt ? `runs until ${new Date(state.endsAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })}.` : 'is now active.'}
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Link href="/questions" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg">Browse questions</Link>
                <Link href="/dashboard" className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-sm rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800">Dashboard</Link>
              </div>
            </>
          )}
          {state.kind === 'error' && (
            <>
              <span className="inline-flex w-12 h-12 rounded-full bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 items-center justify-center mb-3">
                <XIcon size={22} />
              </span>
              <h1 className="font-semibold text-zinc-900 dark:text-white">Could not verify payment</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{state.message}</p>
              <div className="mt-4">
                <Link href="/dashboard/subscription" className="text-sm text-green-600 hover:text-green-700">Try again</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-zinc-400">Loading…</div>}>
      <VerifyInner />
    </Suspense>
  );
}
