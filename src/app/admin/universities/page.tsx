'use client';

import { useEffect, useState, useCallback } from 'react';

interface University {
  id: string;
  name: string;
  short_name: string | null;
  created_at: string;
}

export default function AdminUniversitiesPage() {
  const [items, setItems] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', short_name: '' });
  const [createError, setCreateError] = useState('');
  const [editing, setEditing] = useState<University | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/universities?limit=200');
      const json = await res.json();
      setItems(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    setBusy('create');
    try {
      const res = await fetch('/api/admin/universities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, short_name: form.short_name || null }),
      });
      const json = await res.json();
      if (!res.ok) { setCreateError(json.error ?? 'Failed'); return; }
      setForm({ name: '', short_name: '' });
      load();
    } finally {
      setBusy(null);
    }
  }

  async function save(u: University) {
    setBusy(u.id);
    try {
      const res = await fetch(`/api/admin/universities/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: u.name, short_name: u.short_name }),
      });
      if (res.ok) { setEditing(null); load(); }
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this university? Departments belonging to it will also be removed.')) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/universities/${id}`, { method: 'DELETE' });
      if (res.ok) load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Universities</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage the list shown in dropdowns when creating courses or users.</p>
      </div>

      <form onSubmit={create} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">Add university</h2>
        {createError && <div className="mb-3 text-xs text-red-600 dark:text-red-400">{createError}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="University name *"
            className="sm:col-span-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            value={form.short_name}
            onChange={(e) => setForm((f) => ({ ...f, short_name: e.target.value }))}
            placeholder="Short name (e.g. UNILAG)"
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <button
          type="submit"
          disabled={busy === 'create'}
          className="mt-3 px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg"
        >
          {busy === 'create' ? 'Adding…' : 'Add university'}
        </button>
      </form>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800">
        {loading ? (
          <div className="p-8 text-sm text-zinc-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-sm text-zinc-400 text-center">No universities yet.</div>
        ) : items.map((u) => {
          const isEditing = editing?.id === u.id;
          const row = isEditing ? editing! : u;
          return (
            <div key={u.id} className="px-5 py-3 flex items-center gap-3">
              {isEditing ? (
                <>
                  <input
                    value={row.name}
                    onChange={(e) => setEditing({ ...row, name: e.target.value })}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                  />
                  <input
                    value={row.short_name ?? ''}
                    onChange={(e) => setEditing({ ...row, short_name: e.target.value })}
                    placeholder="Short name"
                    className="w-32 px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                  />
                  <button onClick={() => save(row)} disabled={busy === u.id} className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg">Save</button>
                  <button onClick={() => setEditing(null)} className="px-3 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg">Cancel</button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <div className="text-sm text-zinc-900 dark:text-white font-medium">{u.name}</div>
                    {u.short_name && <div className="text-xs text-zinc-400">{u.short_name}</div>}
                  </div>
                  <button onClick={() => setEditing(u)} className="px-3 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800">Edit</button>
                  <button onClick={() => remove(u.id)} disabled={busy === u.id} className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-950 dark:text-red-400 rounded-lg disabled:opacity-60">Delete</button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
