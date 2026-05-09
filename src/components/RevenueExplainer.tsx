'use client';

import { useState } from 'react';
import { ChevronDownIcon, CoinIcon, SparklesIcon } from './icons';

export default function RevenueExplainer({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 flex items-center justify-center">
            <CoinIcon size={16} />
          </span>
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-white">How earnings are shared</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">A short explanation of the formula</div>
          </div>
        </div>
        <ChevronDownIcon size={16} className={`text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 text-sm text-zinc-600 dark:text-zinc-300 space-y-4">
          <p>
            Each month we add the platform&apos;s net revenue to a <strong>contributor pool</strong>. The pool is
            <strong> 50%</strong> of revenue — the remaining 50% covers infrastructure, payments and moderation.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-400 mb-1">60% — Quality</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-300">
                Based on your weighted contributions: every approved question you submit, extract, edit or correct.
              </div>
            </div>
            <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-400 mb-1">40% — Reach</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-300">
                Based on the total views your contributed questions received during the period.
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 mb-1">Contribution type weights</div>
            <ul className="text-xs text-zinc-600 dark:text-zinc-300 grid grid-cols-2 gap-x-4 gap-y-1">
              <li>Upload &amp; extraction · <span className="font-semibold">×1.0</span></li>
              <li>Correction · <span className="font-semibold">×0.7</span></li>
              <li>Edit · <span className="font-semibold">×0.5</span></li>
              <li>Bonus per pinned answer · curator reward</li>
            </ul>
          </div>

          <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50/60 dark:bg-green-950/30 p-3 text-xs text-green-800 dark:text-green-300">
            <div className="inline-flex items-center gap-1.5 font-semibold mb-1">
              <SparklesIcon size={12} /> Formula
            </div>
            <code className="block whitespace-pre-wrap">
              your_share = (0.6 × your_weighted ÷ total_weighted) + (0.4 × your_views ÷ total_views){'\n'}
              your_payout = your_share × pool_amount
            </code>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Earnings land in your wallet as a <em>contribution_reward</em> credit. Withdraw any time once you have at
            least ₦100 — it&apos;s sent directly to your Nigerian bank account via Paystack.
          </p>
        </div>
      )}
    </div>
  );
}
