'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Course {
  id: string;
  name: string;
  school: string;
  department: string;
  code: string | null;
}

export default function PracticeSetupPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [count, setCount] = useState(10);
  const [school, setSchool] = useState('');
  const [reveal, setReveal] = useState<'after_each' | 'at_end'>('at_end');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/courses?limit=200').then(async (r) => {
      if (r.ok) {
        const j = await r.json();
        setCourses(j.data ?? []);
      }
    });
  }, []);

  const filtered = school
    ? courses.filter((c) => c.school.toLowerCase().includes(school.toLowerCase()))
    : courses;

  async function start() {
    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(Math.min(Math.max(count, 1), 50)) });
      if (courseId) params.set('course_id', courseId);
      const res = await fetch(`/api/questions?${params}`);
      const json = await res.json();
      const ids: string[] = (json.data ?? []).map((q: { id: string }) => q.id);
      if (ids.length === 0) { setError('No questions match these filters.'); return; }
      // Shuffle.
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      const session = {
        ids,
        answers: {} as Record<string, string>,
        startedAt: Date.now(),
        courseId: courseId || null,
        reveal,
      };
      sessionStorage.setItem('practice_session', JSON.stringify(session));
      router.push('/dashboard/practice/run?i=0');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
            ← Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Practice exam</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-6">
          Pick a course and how many questions you want. You&apos;ll see one question per page; your answers are
          checked when you finish.
        </p>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">University (optional filter)</label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="e.g. University of Lagos"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Course</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Any course</option>
              {filtered.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ''} — {c.school}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Number of questions</label>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value || '0'))}
              className="w-32 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">When to show answers</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {([
                { value: 'after_each', title: 'After each question', desc: 'See if you got it right immediately (MCQs only).' },
                { value: 'at_end', title: 'At the end', desc: 'Sit it like a real exam — review answers and score after finishing.' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setReveal(opt.value)}
                  className={`text-left px-4 py-3 rounded-lg border transition-colors ${
                    reveal === opt.value
                      ? 'border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-950/40'
                      : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="text-sm font-medium text-zinc-900 dark:text-white">{opt.title}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={start}
            disabled={loading || count < 1}
            className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
          >
            {loading ? 'Starting…' : 'Start exam'}
          </button>
        </div>
      </div>
    </div>
  );
}
