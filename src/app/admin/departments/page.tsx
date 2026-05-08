'use client';

import { useEffect, useState, useCallback } from 'react';

interface University { id: string; name: string }
interface Department {
  id: string;
  name: string;
  university_id: string;
  universities?: { name: string } | null;
}

export default function AdminDepartmentsPage() {
  const [unis, setUnis] = useState<University[]>([]);
  const [filter, setFilter] = useState('');
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ university_id: '', name: '' });
  const [createError, setCreateError] = useState('');
  const [editing, setEditing] = useState<Department | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set('university_id', filter);
      params.set('limit', '500');
      const res = await fetch(`/api/admin/departments?${params}`);
      const json = await res.json();
      setItems(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetch('/api/universities').then(async (r) => {
      const j = await r.json();
      setUnis(j.data ?? []);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    setBusy('create');
    try {
      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { setCreateError(json.error ?? 'Failed'); return; }
      setForm({ university_id: form.university_id, name: '' });
      load();
    } finally {
      setBusy(null);
    }
  }

  async function save(d: Department) {
    setBusy(d.id);
    try {
      const res = await fetch(`/api/admin/departments/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: d.name, university_id: d.university_id }),
      });
      if (res.ok) { setEditing(null); load(); }
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this department?')) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/departments/${id}`, { method: 'DELETE' });
      if (res.ok) load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Departments</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Each department belongs to a university.</p>
      </div>

      <form onSubmit={create} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">Add department</h2>
        {createError && <div className="mb-3 text-xs text-red-600 dark:text-red-400">{createError}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            required
            value={form.university_id}
            onChange={(e) => setForm((f) => ({ ...f, university_id: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select university *</option>
            {unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Department name *"
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <button
          type="submit"
          disabled={busy === 'create'}
          className="mt-3 px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg"
        >
          {busy === 'create' ? 'Adding…' : 'Add department'}
        </button>
      </form>

      <div className="mb-3">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
        >
          <option value="">All universities</option>
          {unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800">
        {loading ? (
          <div className="p-8 text-sm text-zinc-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-sm text-zinc-400 text-center">No departments yet.</div>
        ) : items.map((d) => {
          const isEditing = editing?.id === d.id;
          const row = isEditing ? editing! : d;
          return (
            <div key={d.id} className="px-5 py-3 flex items-center gap-3">
              {isEditing ? (
                <>
                  <select
                    value={row.university_id}
                    onChange={(e) => setEditing({ ...row, university_id: e.target.value })}
                    className="px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                  >
                    {unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <input
                    value={row.name}
                    onChange={(e) => setEditing({ ...row, name: e.target.value })}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                  />
                  <button onClick={() => save(row)} disabled={busy === d.id} className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg">Save</button>
                  <button onClick={() => setEditing(null)} className="px-3 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg">Cancel</button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <div className="text-sm text-zinc-900 dark:text-white font-medium">{d.name}</div>
                    <div className="text-xs text-zinc-400">{d.universities?.name ?? '—'}</div>
                  </div>
                  <button onClick={() => setEditing(d)} className="px-3 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800">Edit</button>
                  <button onClick={() => remove(d.id)} disabled={busy === d.id} className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-950 dark:text-red-400 rounded-lg disabled:opacity-60">Delete</button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
