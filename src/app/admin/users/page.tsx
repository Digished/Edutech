'use client';

import { useEffect, useState, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  school: string | null;
  department: string | null;
  role: 'student' | 'contributor' | 'admin';
  is_banned: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (roleFilter) params.set('role', roleFilter);
      if (search) params.set('school', search);
      const res = await fetch(`/api/admin/users?${params}`);
      const json = await res.json();
      setUsers(json.data ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, search]);

  useEffect(() => { load(); }, [load]);

  async function updateUser(id: string, patch: { role?: User['role']; is_banned?: boolean }) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const json = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...json.data } : u)));
      }
    } finally {
      setActionLoading(null);
    }
  }

  const roleBadge: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
    contributor: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
    student: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Users</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{total.toLocaleString()} total users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 mb-6 flex flex-wrap gap-3">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }} className="flex gap-2 flex-1 min-w-48">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Filter by university…"
            className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button type="submit" className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors">
            Filter
          </button>
        </form>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All roles</option>
          <option value="student">Student</option>
          <option value="contributor">Contributor</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {/* Users table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="space-y-px">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 bg-zinc-50 dark:bg-zinc-800/50 animate-pulse" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
            <p className="text-sm">No users found</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
            {users.map((u) => (
              <div key={u.id} className={`px-5 py-4 flex items-center gap-4 ${u.is_banned ? 'opacity-60' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">
                      {u.full_name ?? 'No name'}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${roleBadge[u.role]}`}>
                      {u.role}
                    </span>
                    {u.is_banned && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                        Banned
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{u.email}</span>
                    {u.school && <span>· {u.school}</span>}
                    {u.department && <span>· {u.department}</span>}
                    <span>· Joined {new Date(u.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Role selector */}
                  <select
                    value={u.role}
                    disabled={actionLoading === u.id}
                    onChange={(e) => updateUser(u.id, { role: e.target.value as User['role'] })}
                    className="px-2 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60"
                  >
                    <option value="student">Student</option>
                    <option value="contributor">Contributor</option>
                    <option value="admin">Admin</option>
                  </select>

                  {/* Ban/unban */}
                  <button
                    disabled={actionLoading === u.id}
                    onClick={() => updateUser(u.id, { is_banned: !u.is_banned })}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors disabled:opacity-60 ${
                      u.is_banned
                        ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-950 dark:text-green-400'
                        : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-400'
                    }`}
                  >
                    {actionLoading === u.id ? '…' : u.is_banned ? 'Unban' : 'Ban'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              Previous
            </button>
            <span className="text-xs text-zinc-400">Page {page} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
