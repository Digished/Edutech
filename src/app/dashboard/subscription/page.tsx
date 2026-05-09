'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon, ArrowRightIcon, CheckIcon, LockIcon, PlusIcon, SparklesIcon, TrashIcon,
} from '@/components/icons';
import SearchSelect from '@/components/SearchSelect';

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
    perks: ['Per department', 'Cancel anytime', 'Step-by-step explanations'],
  },
  {
    id: 'quarterly',
    label: '3 months',
    amount: 3000,
    monthlyEq: 1000,
    badge: 'Save ₦1,500',
    perks: ['Save vs monthly', 'Per department', 'Step-by-step explanations'],
  },
  {
    id: 'yearly',
    label: '12 months',
    amount: 10000,
    monthlyEq: Math.round(10000 / 12),
    badge: 'Best value',
    perks: ['Best value', 'Per department', 'Priority support'],
  },
];

const CONTRIBUTOR_DISCOUNT = 0.6; // 60% off

interface University { id: string; name: string; short_name: string | null }
interface Department { id: string; name: string }

interface UnlockedDept {
  id: string;
  school: string;
  department: string;
  plan: Plan;
  starts_at: string | null;
  ends_at: string | null;
}

interface Status {
  is_admin: boolean;
  is_contributor: boolean;
  has_full_access: boolean;
  unlocked_departments: UnlockedDept[];
}

function ngn(value: number): string {
  return `₦${value.toLocaleString('en-NG')}`;
}

export default function SubscriptionPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [universities, setUniversities] = useState<University[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [school, setSchool] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [plan, setPlan] = useState<Plan>('quarterly');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);

  async function refreshStatus() {
    const res = await fetch('/api/contributor-status');
    if (res.ok) {
      const j = await res.json();
      setStatus(j.data);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, u] = await Promise.all([
        fetch('/api/contributor-status'),
        fetch('/api/universities'),
      ]);
      if (cancelled) return;
      if (s.status === 401) { window.location.href = '/login?next=/dashboard/subscription'; return; }
      if (s.ok) { const j = await s.json(); setStatus(j.data); }
      if (u.ok) { const j = await u.json(); setUniversities(j.data ?? []); }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!school) { setDepartments([]); setSelectedDepts([]); return; }
    let cancelled = false;
    fetch(`/api/departments?university=${encodeURIComponent(school)}`).then(async (r) => {
      if (cancelled) return;
      if (r.ok) {
        const j = await r.json();
        setDepartments(j.data ?? []);
      }
    });
    return () => { cancelled = true; };
  }, [school]);

  const unlockedKeys = useMemo(() => {
    const set = new Set<string>();
    (status?.unlocked_departments ?? []).forEach((d) => set.add(`${d.school}::${d.department}`));
    return set;
  }, [status]);

  const pricing = useMemo(() => {
    const planRow = PLANS.find((p) => p.id === plan)!;
    const eligible = selectedDepts.filter((d) => !unlockedKeys.has(`${school}::${d}`));
    const count = eligible.length;
    const gross = planRow.amount * count;
    const isContributor = !!status?.is_contributor;
    const discountPct = isContributor ? CONTRIBUTOR_DISCOUNT : 0;
    const discount = Math.round(gross * discountPct);
    const net = gross - discount;
    return { planRow, count, gross, discount, net, isContributor, eligible };
  }, [plan, selectedDepts, unlockedKeys, school, status?.is_contributor]);

  function toggleDept(name: string) {
    setSelectedDepts((arr) => (arr.includes(name) ? arr.filter((d) => d !== name) : [...arr, name]));
  }

  async function startCheckout() {
    setError('');
    if (!school) { setError('Pick a university'); return; }
    if (pricing.count === 0) { setError('Pick at least one department to unlock'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          combos: pricing.eligible.map((d) => ({ school, department: d })),
        }),
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

  async function cancelOne(id: string) {
    setCancelling(id);
    try {
      const res = await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
      if (res.ok) await refreshStatus();
    } finally {
      setCancelling(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-sm">Loading…</div>
      </div>
    );
  }

  const isAdmin = !!status?.is_admin;
  const isContributor = !!status?.is_contributor;
  const unlocked = status?.unlocked_departments ?? [];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 inline-flex items-center gap-1.5">
            <ArrowLeftIcon size={14} /> Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 flex items-center justify-center">
            <SparklesIcon size={18} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Subscriptions</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Subscribe per university and department. Bundle multiple departments in one checkout.
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="mb-5 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 px-4 py-3 rounded-lg text-xs">
            You&apos;re an admin — you have access to every department without subscribing.
          </div>
        )}

        {isContributor && !isAdmin && (
          <div className="mb-5 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 text-green-800 dark:text-green-400 px-4 py-3 rounded-lg text-xs">
            <span className="font-semibold">Contributor pricing:</span> 60% off all subscriptions and bundles.
          </div>
        )}

        {/* Active subscriptions */}
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Your unlocked departments</h2>
        {unlocked.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            <div className="inline-flex items-center gap-2 text-zinc-700 dark:text-zinc-200 font-medium mb-1">
              <LockIcon size={14} /> Nothing unlocked yet
            </div>
            <p className="text-xs">Pick a university and one or more departments below to subscribe.</p>
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {unlocked.map((d) => {
              const daysLeft = d.ends_at
                ? Math.max(0, Math.ceil((new Date(d.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                : null;
              return (
                <div key={d.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-900 dark:text-white">
                      {d.department} <span className="text-zinc-400 font-normal">· {d.school}</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {PLANS.find((p) => p.id === d.plan)?.label ?? d.plan} ·{' '}
                      {d.ends_at
                        ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left · ends ${new Date(d.ends_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : 'active'}
                    </div>
                  </div>
                  <button
                    onClick={() => cancelOne(d.id)}
                    disabled={cancelling === d.id}
                    className="text-xs text-zinc-500 hover:text-red-600 disabled:opacity-50 inline-flex items-center gap-1"
                    title="Cancel"
                  >
                    <TrashIcon size={12} /> {cancelling === d.id ? 'Cancelling…' : 'Cancel'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Checkout */}
        {!isAdmin && (
          <>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Unlock more departments</h2>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-5">
              {error && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">University</label>
                <SearchSelect
                  options={universities.map((u) => ({ value: u.name, label: u.name, hint: u.short_name ?? undefined }))}
                  value={school}
                  onChange={(v) => { setSchool(v); setSelectedDepts([]); }}
                  placeholder="Pick a university"
                  emptyText="No matching universities"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Departments</label>
                {!school ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Pick a university first.</p>
                ) : departments.length === 0 ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">No departments listed for this university.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {departments.map((d) => {
                      const checked = selectedDepts.includes(d.name);
                      const already = unlockedKeys.has(`${school}::${d.name}`);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          disabled={already}
                          onClick={() => toggleDept(d.name)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            already
                              ? 'border-green-300 bg-green-50 text-green-700 cursor-not-allowed dark:border-green-800 dark:bg-green-950 dark:text-green-400'
                              : checked
                              ? 'border-green-400 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/50 dark:text-green-400'
                              : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                          }`}
                          title={already ? 'Already unlocked' : ''}
                        >
                          {already ? <CheckIcon size={12} className="inline -mt-0.5 mr-1" /> : checked ? <CheckIcon size={12} className="inline -mt-0.5 mr-1" /> : <PlusIcon size={12} className="inline -mt-0.5 mr-1" />}
                          {d.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Plan</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {PLANS.map((p) => {
                    const active = plan === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlan(p.id)}
                        className={`text-left p-3 rounded-lg border transition-colors ${
                          active
                            ? 'border-green-400 bg-green-50/60 dark:border-green-700 dark:bg-green-950/30'
                            : 'border-zinc-200 dark:border-zinc-700 hover:border-green-300'
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
                        <div className="text-base font-bold text-zinc-900 dark:text-white">{ngn(p.amount)}</div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">≈ {ngn(p.monthlyEq)}/month per dept</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pricing summary */}
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 p-4 text-sm">
                <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-200">
                  <span>{ngn(pricing.planRow.amount)} × {pricing.count} department{pricing.count === 1 ? '' : 's'}</span>
                  <span>{ngn(pricing.gross)}</span>
                </div>
                {pricing.isContributor && pricing.discount > 0 && (
                  <div className="mt-1 flex items-center justify-between text-green-700 dark:text-green-400">
                    <span>Contributor discount (60% off)</span>
                    <span>−{ngn(pricing.discount)}</span>
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between font-semibold text-zinc-900 dark:text-white">
                  <span>Total</span>
                  <span>{ngn(pricing.net)}</span>
                </div>
              </div>

              <button
                onClick={startCheckout}
                disabled={submitting || pricing.count === 0}
                className="w-full inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium py-3 rounded-lg text-sm transition-colors"
              >
                {submitting ? 'Starting checkout…' : pricing.count === 0 ? 'Pick a department to subscribe' : `Pay ${ngn(pricing.net)} via Paystack`}
                {pricing.count > 0 && !submitting && <ArrowRightIcon size={14} />}
              </button>

              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-1.5">
                <LockIcon size={11} /> Secure payment via Paystack. No automatic renewals.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
