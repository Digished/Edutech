'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon, ArrowRightIcon, CheckIcon, LockIcon, SparklesIcon,
} from '@/components/icons';

type Plan = 'monthly' | 'quarterly' | 'yearly';

interface PlanCard {
  id: Plan;
  label: string;
  amount: number;
  perks: string[];
  badge?: string;
  monthlyEq: number;
}

const PLANS: PlanCard[] = [
  {
    id: 'monthly',
    label: 'Monthly',
    amount: 1500,
    monthlyEq: 1500,
    perks: ['All approved questions unlocked', 'Practice exams', 'AI-graded theory'],
  },
  {
    id: 'quarterly',
    label: '3 months',
    amount: 3000,
    monthlyEq: 1000,
    badge: 'Save ₦1,500',
    perks: ['Save ₦1,500 vs monthly', 'All approved questions unlocked', 'AI-graded theory'],
  },
  {
    id: 'yearly',
    label: '12 months',
    amount: 10000,
    monthlyEq: Math.round(10000 / 12),
    badge: 'Best value',
    perks: ['Save ₦8,000 vs monthly', 'All approved questions unlocked', 'Priority support'],
  },
];

interface Status {
  has_active_subscription: boolean;
  subscription: {
    plan: Plan;
    status: string;
    starts_at: string | null;
    ends_at: string | null;
  } | null;
  is_contributor: boolean;
}

export default function SubscriptionPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [selected, setSelected] = useState<Plan>('quarterly');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/contributor-status').then(async (r) => {
      if (r.ok) {
        const j = await r.json();
        setStatus(j.data);
      }
      setLoading(false);
    });
  }, []);

  async function startCheckout() {
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selected }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Could not start checkout');
        return;
      }
      window.location.href = json.data.authorization_url;
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-sm">Loading…</div>
      </div>
    );
  }

  const hasSub = status?.has_active_subscription;
  const isContributor = status?.is_contributor;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
            <span className="inline-flex items-center gap-1.5"><ArrowLeftIcon size={14} /> Dashboard</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 flex items-center justify-center">
            <SparklesIcon size={18} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Unlock the question bank</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Pay once for the period — cancel anytime.</p>
          </div>
        </div>

        {hasSub && status?.subscription && (
          <div className="mb-5 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 px-4 py-3 rounded-lg text-sm">
            <div className="font-semibold flex items-center gap-1.5"><CheckIcon size={14} /> {PLANS.find((p) => p.id === status.subscription!.plan)?.label} plan active</div>
            <div className="text-xs mt-1">
              {status.subscription.ends_at
                ? `Ends ${new Date(status.subscription.ends_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })}`
                : null}
            </div>
          </div>
        )}

        {isContributor && (
          <div className="mb-5 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 px-4 py-3 rounded-lg text-xs">
            Contributors have full access automatically — you don&apos;t need a subscription.
          </div>
        )}

        {error && (
          <div className="mb-5 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {PLANS.map((p) => {
            const active = selected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={`text-left p-4 rounded-xl border transition-colors ${
                  active
                    ? 'border-green-400 bg-green-50/60 dark:border-green-700 dark:bg-green-950/30'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-green-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white">{p.label}</div>
                  {p.badge && (
                    <span className="text-[10px] uppercase tracking-wide font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950 px-1.5 py-0.5 rounded">
                      {p.badge}
                    </span>
                  )}
                </div>
                <div className="text-xl font-bold text-zinc-900 dark:text-white">₦{p.amount.toLocaleString()}</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">≈ ₦{p.monthlyEq.toLocaleString()} / month</div>
                <ul className="mt-3 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                  {p.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-1.5">
                      <CheckIcon size={12} className="text-green-600 mt-0.5 shrink-0" /> <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <button
          onClick={startCheckout}
          disabled={submitting || isContributor}
          className="w-full inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium py-3 rounded-lg text-sm transition-colors"
        >
          {isContributor
            ? 'Contributors don’t need a subscription'
            : hasSub
            ? `Renew or upgrade — pay ₦${PLANS.find((p) => p.id === selected)!.amount.toLocaleString()}`
            : `Pay ₦${PLANS.find((p) => p.id === selected)!.amount.toLocaleString()} via Paystack`}
          {!isContributor && <ArrowRightIcon size={14} />}
        </button>

        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-1.5">
          <LockIcon size={12} /> Secure payment powered by Paystack. No automatic renewals.
        </p>
      </div>
    </div>
  );
}
