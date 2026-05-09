'use client';

import { useEffect, useState, useCallback } from 'react';

interface Course {
  id: string;
  school: string;
  faculty: string;
  department: string;
  name: string;
  code: string | null;
  created_by: string | null;
  created_at: string;
}

export default function AdminCoursesPage() {
  const [items, setItems] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Course | null>(null);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('school', search);
      const res = await fetch(`/api/courses?${params}`);
      const json = await res.json();
      setItems(json.data ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  // Admins can rename a course or change its code; reassigning to a different
  // department/faculty would require recomputing every linked question, so
  // we don't support that from the UI.
  async function save(c: Course) {
    setBusy(c.id);
    try {
      const res = await fetch(`/api/courses/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: c.name, code: c.code ?? null }),
      });
      if (res.ok) { setEditing(null); load(); }
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this course? Questions and uploads tied to it will also be removed.')) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/courses/${id}`, { method: 'DELETE' });
      if (res.ok) load();
    } finally {
      setBusy(null);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Courses</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{total.toLocaleString()} courses created by users.</p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 mb-4 flex gap-2">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Filter by university…"
          className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
        />
        <button type="submit" className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg">Filter</button>
      </form>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800">
        {loading ? (
          <div className="p-8 text-sm text-zinc-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-sm text-zinc-400 text-center">No courses yet.</div>
        ) : items.map((c) => {
          const isEditing = editing?.id === c.id;
          const row = isEditing ? editing! : c;
          return (
            <div key={c.id} className="px-5 py-3">
              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                  <input value={row.name} onChange={(e) => setEditing({ ...row, name: e.target.value })}
                    placeholder="Name" className="px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" />
                  <input value={row.code ?? ''} onChange={(e) => setEditing({ ...row, code: e.target.value })}
                    placeholder="Code" className="px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm" />
                  <div className="sm:col-span-2 text-[11px] text-zinc-400">
                    {c.school} · {c.faculty ?? '—'} · {c.department}
                  </div>
                  <div className="sm:col-span-2 flex gap-2">
                    <button onClick={() => save(row)} disabled={busy === c.id} className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg">Save</button>
                    <button onClick={() => setEditing(null)} className="px-3 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-900 dark:text-white font-medium truncate">
                      {c.name}{c.code ? ` (${c.code})` : ''}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5 truncate">
                      {c.school} · {c.faculty ?? '—'} · {c.department}
                    </div>
                  </div>
                  <button onClick={() => setEditing(c)} className="px-3 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800">Edit</button>
                  <button onClick={() => remove(c.id)} disabled={busy === c.id} className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-950 dark:text-red-400 rounded-lg disabled:opacity-60">Delete</button>
                </div>
              )}
            </div>
          );
        })}

        {totalPages > 1 && (
          <div className="px-5 py-4 flex items-center justify-between">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40">
              Previous
            </button>
            <span className="text-xs text-zinc-400">Page {page} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
