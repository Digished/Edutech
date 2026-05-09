'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import SearchSelect from '@/components/SearchSelect';
import {
  InboxIcon, LockIcon, SearchIcon, SparklesIcon,
} from '@/components/icons';
import { Brand } from '@/components/Logo';

interface Course {
  id: string;
  name: string;
  school: string;
  department: string;
  code: string | null;
}

interface University { id: string; name: string; short_name: string | null }

interface Question {
  id: string;
  question_text: string;
  options: Record<string, string> | null;
  correct_answer: string | null;
  year: number | null;
  level: number | null;
  semester: number | null;
  question_type: 'mcq' | 'theory';
  image_urls: string[] | null;
  courses: Course;
  question_analytics: { views_count: number }[] | { views_count: number } | null;
}

function viewsOf(q: Question): number {
  const a = q.question_analytics;
  if (!a) return 0;
  if (Array.isArray(a)) return a[0]?.views_count ?? 0;
  return a.views_count ?? 0;
}

interface Me {
  id: string;
  full_name: string | null;
  email: string;
  role: 'student' | 'contributor' | 'admin';
}

interface UnlockedDept { id: string; school: string; department: string }

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [unlocked, setUnlocked] = useState<UnlockedDept[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [school, setSchool] = useState('');
  const [level, setLevel] = useState<number | ''>('');
  const [semester, setSemester] = useState<number | ''>('');
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);

  const fetchCourses = useCallback(async () => {
    const params = new URLSearchParams({ limit: '100' });
    if (school) params.set('school', school);
    const res = await fetch(`/api/courses?${params}`);
    const json = await res.json();
    setCourses(json.data ?? []);
  }, [school]);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setSubscriptionRequired(false);
    try {
      let url: string;
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (selectedCourse) params.set('course_id', selectedCourse);
      if (school)    params.set('school', school);
      if (level)     params.set('level', String(level));
      if (semester)  params.set('semester', String(semester));

      if (search.trim().length >= 3) {
        params.set('q', search);
        url = `/api/questions/search?${params}`;
      } else {
        url = `/api/questions?${params}`;
      }

      const res = await fetch(url);
      if (res.status === 403) {
        setSubscriptionRequired(true);
        setQuestions([]);
        setTotal(0);
        return;
      }
      const json = await res.json();
      setQuestions(json.data ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedCourse, school, level, semester]);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);
  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);
  useEffect(() => {
    fetch('/api/universities').then(async (r) => {
      if (r.ok) { const j = await r.json(); setUniversities(j.data ?? []); }
    });
  }, []);

  useEffect(() => {
    fetch('/api/auth/me').then(async (r) => {
      if (r.status === 401) { window.location.href = '/login?next=/questions'; return; }
      if (r.ok) {
        const j = await r.json();
        setMe(j.data ?? null);
      }
    });
    fetch('/api/contributor-status').then(async (r) => {
      if (r.ok) {
        const j = await r.json();
        setUnlocked(j.data?.unlocked_departments ?? []);
        setIsAdmin(!!j.data?.is_admin);
      }
      setStatusLoaded(true);
    });
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Nav */}
      <nav className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Brand size="sm" href={me ? '/dashboard' : '/'} />
          <div className="flex items-center gap-3 min-w-0">
            {me ? (
              <>
                <Link href="/dashboard" className="text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Dashboard
                </Link>
                <span className="text-sm text-zinc-500 dark:text-zinc-400 truncate max-w-[10rem] hidden sm:inline">
                  {me.full_name ?? me.email}
                </span>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Log in
                </Link>
                <Link href="/register" className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Question Bank</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{total.toLocaleString()} questions available</p>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 mb-6">
          <div className="flex flex-col sm:flex-row gap-2">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <div className="flex-1 relative">
                <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search questions…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
                Search
              </button>
            </form>
            <SearchSelect
              className="sm:w-56"
              options={universities.map((u) => ({ value: u.name, label: u.name, hint: u.short_name ?? undefined }))}
              value={school}
              onChange={(v) => { setSchool(v); setSelectedCourse(''); setPage(1); }}
              placeholder="All universities"
              emptyText="No matching universities"
            />
            <SearchSelect
              className="sm:w-56"
              options={(school ? courses.filter((c) => c.school === school) : courses)
                .map((c) => ({ value: c.id, label: `${c.name}${c.code ? ` (${c.code})` : ''}`, hint: c.school }))}
              value={selectedCourse}
              onChange={(v) => { setSelectedCourse(v); setPage(1); }}
              placeholder="All courses"
              emptyText="No matching courses"
            />
            <select
              value={level}
              onChange={(e) => { setLevel(e.target.value === '' ? '' : Number(e.target.value)); setPage(1); }}
              className="sm:w-32 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Any level</option>
              {[100, 200, 300, 400, 500, 600].map((l) => <option key={l} value={l}>{l} level</option>)}
            </select>
            <select
              value={semester}
              onChange={(e) => { setSemester(e.target.value === '' ? '' : Number(e.target.value)); setPage(1); }}
              className="sm:w-40 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Any semester</option>
              {[1, 2, 3].map((s) => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
        </div>

        {/* No unlocks at all */}
        {statusLoaded && !isAdmin && unlocked.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-green-200 dark:border-green-900 p-8 text-center">
            <span className="inline-flex w-12 h-12 rounded-full bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 items-center justify-center mb-3">
              <LockIcon size={20} />
            </span>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Unlock a department to start browsing</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
              Subscriptions are per university and department. Pick the ones you need — you can bundle multiple in a single payment.
            </p>
            <Link
              href="/dashboard/subscription"
              className="inline-flex items-center gap-2 mt-5 bg-green-600 hover:bg-green-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm"
            >
              <SparklesIcon size={14} /> See subscriptions
            </Link>
          </div>
        ) : subscriptionRequired ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-green-200 dark:border-green-900 p-8 text-center">
            <span className="inline-flex w-12 h-12 rounded-full bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 items-center justify-center mb-3">
              <LockIcon size={20} />
            </span>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">This department isn&apos;t unlocked yet</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
              Add it to your subscriptions to view and practice questions here.
            </p>
            <Link
              href="/dashboard/subscription"
              className="inline-flex items-center gap-2 mt-5 bg-green-600 hover:bg-green-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm"
            >
              <SparklesIcon size={14} /> Manage subscriptions
            </Link>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 animate-pulse">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4 mb-3" />
                <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16 text-zinc-400 dark:text-zinc-500">
            <InboxIcon size={36} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
            <p className="font-medium">No questions found</p>
            <p className="text-sm mt-1">Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <Link key={q.id} href={`/questions/${q.id}`} className="block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 hover:border-green-200 dark:hover:border-green-800 transition-colors">
                <div className="flex items-start gap-2 mb-2">
                  <span className={`shrink-0 text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${
                    q.question_type === 'theory'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                  }`}>
                    {q.question_type === 'theory' ? 'Theory' : 'MCQ'}
                  </span>
                </div>
                <p className="text-zinc-900 dark:text-white text-sm leading-relaxed font-medium whitespace-pre-line">
                  {q.question_text}
                </p>
                {Array.isArray(q.image_urls) && q.image_urls.length > 0 && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {q.image_urls.slice(0, 3).map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={`${url}-${i}`}
                        src={url}
                        alt=""
                        className="h-24 w-auto max-w-full rounded-lg border border-zinc-200 dark:border-zinc-800 object-cover"
                      />
                    ))}
                  </div>
                )}
                {q.options && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {Object.entries(q.options).map(([key, val]) => (
                      <div
                        key={key}
                        className="text-xs px-3 py-1.5 rounded-lg border border-zinc-100 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400"
                      >
                        <span className="font-semibold">{key}.</span> {val}
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-zinc-400">
                  <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    {q.courses?.name ?? 'Unknown course'}
                  </span>
                  {q.year && <span>{q.year}</span>}
                  {q.level && <span>{q.level}L</span>}
                  {q.semester && <span>S{q.semester}</span>}
                  <span>{viewsOf(q)} views</span>
                  <span className="text-zinc-300 dark:text-zinc-600">{q.courses?.school}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-zinc-500 dark:text-zinc-400 px-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
