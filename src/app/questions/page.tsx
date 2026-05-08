'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Course {
  id: string;
  name: string;
  school: string;
  department: string;
  code: string | null;
}

interface Question {
  id: string;
  question_text: string;
  options: Record<string, string> | null;
  correct_answer: string | null;
  year: number | null;
  courses: Course;
  question_analytics: { views_count: number }[];
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [school, setSchool] = useState('');

  const fetchCourses = useCallback(async () => {
    const params = new URLSearchParams({ limit: '100' });
    if (school) params.set('school', school);
    const res = await fetch(`/api/courses?${params}`);
    const json = await res.json();
    setCourses(json.data ?? []);
  }, [school]);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      let url: string;
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (selectedCourse) params.set('course_id', selectedCourse);

      if (search.trim().length >= 3) {
        params.set('q', search);
        url = `/api/questions/search?${params}`;
      } else {
        url = `/api/questions?${params}`;
      }

      const res = await fetch(url);
      const json = await res.json();
      setQuestions(json.data ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedCourse]);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);
  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Nav */}
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">E</span>
            </div>
            <span className="font-semibold text-zinc-900 dark:text-white">EduTech</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors">
              Log in
            </Link>
            <Link href="/register" className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Question Bank</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{total.toLocaleString()} questions available</p>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search questions…"
                className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors">
                Search
              </button>
            </form>
            <input
              type="text"
              value={school}
              onChange={(e) => { setSchool(e.target.value); setSelectedCourse(''); setPage(1); }}
              placeholder="Filter by university…"
              className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 sm:w-56"
            />
            <select
              value={selectedCourse}
              onChange={(e) => { setSelectedCourse(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 sm:w-56"
            >
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name} {c.code ? `(${c.code})` : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Questions list */}
        {loading ? (
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
            <div className="text-4xl mb-3">📭</div>
            <p className="font-medium">No questions found</p>
            <p className="text-sm mt-1">Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 hover:border-green-200 dark:hover:border-green-800 transition-colors">
                <p className="text-zinc-900 dark:text-white text-sm leading-relaxed font-medium">
                  {q.question_text}
                </p>
                {q.options && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {Object.entries(q.options).map(([key, val]) => (
                      <div
                        key={key}
                        className={`text-xs px-3 py-1.5 rounded-lg border ${
                          q.correct_answer === key
                            ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
                            : 'border-zinc-100 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}
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
                  <span>{q.question_analytics?.[0]?.views_count ?? 0} views</span>
                  <span className="text-zinc-300 dark:text-zinc-600">{q.courses?.school}</span>
                </div>
              </div>
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
