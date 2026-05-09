'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';

interface University { id: string; name: string }
interface Department { id: string; name: string; university_id: string }

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    school: '',
    department: '',
  });
  const [universities, setUniversities] = useState<University[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/universities').then(async (r) => {
      const j = await r.json();
      setUniversities(j.data ?? []);
    });
  }, []);

  useEffect(() => {
    if (!form.school) { setDepartments([]); return; }
    fetch(`/api/departments?university=${encodeURIComponent(form.school)}`).then(async (r) => {
      const j = await r.json();
      setDepartments(j.data ?? []);
    });
  }, [form.school]);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Registration failed');
        return;
      }
      window.location.href = '/dashboard';
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <span className="font-semibold text-zinc-900 dark:text-white text-lg">EduTech</span>
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Create your account</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Start accessing and contributing questions</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Full name</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => update('full_name', e.target.value)}
                placeholder="Ada Lovelace"
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Password <span className="text-red-500">*</span></label>
              <PasswordInput
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="Min. 8 characters"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">University</label>
              {universities.length > 0 ? (
                <select
                  value={form.school}
                  onChange={(e) => { update('school', e.target.value); update('department', ''); }}
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select your university…</option>
                  {universities.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={form.school}
                  onChange={(e) => update('school', e.target.value)}
                  placeholder="e.g. University of Lagos"
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Department</label>
              {departments.length > 0 ? (
                <select
                  value={form.department}
                  onChange={(e) => update('department', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select your department…</option>
                  {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => update('department', e.target.value)}
                  placeholder="e.g. Computer Science"
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-green-600 hover:text-green-700 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
