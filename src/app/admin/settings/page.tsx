'use client';

import { useEffect, useState } from 'react';

export default function AdminSettingsPage() {
  const [reward, setReward] = useState<number | ''>('');
  const [bucket, setBucket] = useState<number>(100);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings').then(async (r) => {
      if (!r.ok) { setLoading(false); return; }
      const j = await r.json();
      setReward(j.data.reward_per_100_questions);
      setBucket(j.data.reward_bucket_size);
      setLoading(false);
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSaved(false);
    if (typeof reward !== 'number' || reward <= 0) {
      setError('Enter a positive amount.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reward_per_100_questions: reward }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? 'Could not save.'); return; }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Settings</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
        These values apply globally and are reflected on every contributor screen.
      </p>

      {loading ? (
        <div className="text-sm text-zinc-400">Loading…</div>
      ) : (
        <form onSubmit={save} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1.5">
              Contributor reward
            </label>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">₦</span>
              <input
                type="number"
                min={1}
                step="any"
                value={reward}
                onChange={(e) => setReward(e.target.value === '' ? '' : Number(e.target.value))}
                className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <span className="text-sm text-zinc-500">per {bucket} approved questions</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
              New {bucket}-question buckets are credited at this rate. Already-credited buckets keep the rate they had at the time.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
          {saved && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm px-3 py-2 rounded-lg">
              Saved.
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      )}
    </div>
  );
}
