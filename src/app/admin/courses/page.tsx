'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';

interface University { id: string; name: string }
interface Faculty   { id: string; name: string; university_id: string }
interface Department { id: string; name: string; faculty_id: string }

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

// One row in the bulk-add textarea: "Course name" or "Course name | CODE".
function parseCourseLines(text: string): { name: string; code: string | null }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawName, rawCode] = line.split('|');
      const name = (rawName ?? '').trim();
      const code = rawCode && rawCode.trim() ? rawCode.trim() : null;
      return { name, code };
    })
    .filter((row) => row.name.length > 0);
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

  const [unis, setUnis] = useState<University[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [universityId, setUniversityId] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [createMsg, setCreateMsg] = useState('');
  const [createErr, setCreateErr] = useState('');

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

  // Cascading lookups for the bulk creator.
  useEffect(() => {
    fetch('/api/universities').then(async (r) => {
      const j = await r.json();
      setUnis(j.data ?? []);
    });
  }, []);
  useEffect(() => {
    setFaculties([]); setFacultyId('');
    setDepartments([]); setDepartmentId('');
    if (!universityId) return;
    fetch(`/api/faculties?university_id=${encodeURIComponent(universityId)}`).then(async (r) => {
      if (r.ok) { const j = await r.json(); setFaculties(j.data ?? []); }
    });
  }, [universityId]);
  useEffect(() => {
    setDepartments([]); setDepartmentId('');
    if (!facultyId) return;
    fetch(`/api/admin/departments?faculty_id=${encodeURIComponent(facultyId)}&limit=500`).then(async (r) => {
      if (r.ok) { const j = await r.json(); setDepartments(j.data ?? []); }
    });
  }, [facultyId]);

  const parsed = useMemo(() => parseCourseLines(bulkText), [bulkText]);

  async function bulkCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateErr(''); setCreateMsg('');
    if (!universityId) { setCreateErr('Pick a university.'); return; }
    if (!facultyId)    { setCreateErr('Pick a faculty.'); return; }
    if (!departmentId) { setCreateErr('Pick a department.'); return; }
    if (parsed.length === 0) { setCreateErr('Add at least one course.'); return; }

    setBusy('create');
    try {
      const results = await Promise.all(
        parsed.map((c) =>
          fetch('/api/courses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              department_id: departmentId,
              name: c.name,
              code: c.code,
            }),
          }).then(async (r) => ({ ok: r.ok, name: c.name, body: await r.json().catch(() => ({})) })),
        ),
      );
      const failed = results.filter((r) => !r.ok);
      if (failed.length === 0) {
        setCreateMsg(`Added ${results.length} course${results.length === 1 ? '' : 's'}.`);
      } else if (failed.length === results.length) {
        setCreateErr(failed[0].body?.error ?? 'Failed to add courses.');
      } else {
        setCreateMsg(`Added ${results.length - failed.length}.`);
        setCreateErr(`${failed.length} failed: ${failed.map((f) => f.name).join(', ')}`);
      }
      setBulkText('');
      load();
    } finally {
      setBusy(null);
    }
  }

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
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{total.toLocaleString()} courses created.</p>
        </div>
      </div>

      {/* Bulk add */}
      <form onSubmit={bulkCreate} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mb-6 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Add courses</h2>

        {createErr && <div className="text-xs text-red-600 dark:text-red-400">{createErr}</div>}
        {createMsg && <div className="text-xs text-green-700 dark:text-green-400">{createMsg}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            required value={universityId}
            onChange={(e) => setUniversityId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">University *</option>
            {unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select
            required value={facultyId}
            onChange={(e) => setFacultyId(e.target.value)}
            disabled={!universityId}
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60"
          >
            <option value="">Faculty *</option>
            {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select
            required value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            disabled={!facultyId}
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60"
          >
            <option value="">Department *</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={5}
          placeholder={'One course per line. Add an optional code after a "|".\nE.g.\nIntroduction to Computer Science | CSC101\nLinear Algebra | MTH201\nIntroduction to Statistics'}
          className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-y font-mono"
        />
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {parsed.length === 0
              ? 'No courses parsed yet.'
              : `${parsed.length} course${parsed.length === 1 ? '' : 's'} ready to add.`}
          </span>
          <button
            type="submit"
            disabled={busy === 'create' || parsed.length === 0}
            className="px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg"
          >
            {busy === 'create' ? 'Adding…' : `Add ${parsed.length || ''} course${parsed.length === 1 ? '' : 's'}`.trim()}
          </button>
        </div>
      </form>

      {/* Existing list */}
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
