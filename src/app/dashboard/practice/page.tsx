'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SearchSelect from '@/components/SearchSelect';
import { ArrowLeftIcon, ArrowRightIcon, FlaskIcon, PlayIcon, TrashIcon } from '@/components/icons';

interface Course {
  id: string;
  name: string;
  school: string;
  department: string;
  code: string | null;
}

interface University { id: string; name: string; short_name: string | null }

interface PausedSummary {
  total: number;
  answered: number;
}

export default function PracticeSetupPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [courseId, setCourseId] = useState('');
  const [count, setCount] = useState(10);
  const [school, setSchool] = useState('');
  const [reveal, setReveal] = useState<'after_each' | 'at_end'>('at_end');
  const [questionType, setQuestionType] = useState<'mcq' | 'theory' | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paused, setPaused] = useState<PausedSummary | null>(null);

  useEffect(() => {
    fetch('/api/courses?limit=200').then(async (r) => {
      if (r.ok) { const j = await r.json(); setCourses(j.data ?? []); }
    });
    fetch('/api/universities').then(async (r) => {
      if (r.ok) { const j = await r.json(); setUniversities(j.data ?? []); }
    });
    const raw = sessionStorage.getItem('practice_session');
    if (raw) {
      try {
        const s = JSON.parse(raw) as { ids: string[]; answers: Record<string, string> };
        if (s.ids?.length) {
          const answered = Object.values(s.answers ?? {}).filter((v) => v && v.trim()).length;
          setPaused({ total: s.ids.length, answered });
        }
      } catch { /* ignore */ }
    }
  }, []);

  const filtered = school
    ? courses.filter((c) => c.school === school)
    : courses;

  const universityOptions = universities.map((u) => ({
    value: u.name,
    label: u.name,
    hint: u.short_name ?? undefined,
  }));

  const courseOptions = filtered.map((c) => ({
    value: c.id,
    label: `${c.name}${c.code ? ` (${c.code})` : ''}`,
    hint: c.school,
  }));

  function discardPaused() {
    sessionStorage.removeItem('practice_session');
    setPaused(null);
  }

  async function start() {
    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(Math.min(Math.max(count, 1), 50)) });
      if (courseId) params.set('course_id', courseId);
      if (questionType !== 'all') params.set('question_type', questionType);
      const res = await fetch(`/api/questions?${params}`);
      const json = await res.json();
      const ids: string[] = (json.data ?? []).map((q: { id: string }) => q.id);
      if (ids.length === 0) { setError('No questions match these filters.'); return; }
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
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-2">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
            <ArrowLeftIcon size={14} /> Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 flex items-center justify-center">
            <FlaskIcon size={18} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Practice exam</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">One question per page · pause anytime</p>
          </div>
        </div>

        {paused && (
          <div className="mb-5 bg-white dark:bg-zinc-900 border border-green-200 dark:border-green-900 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-green-600 text-white flex items-center justify-center">
                <PlayIcon size={16} />
              </span>
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-white">Paused exam available</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {paused.answered} of {paused.total} answered
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={discardPaused}
                className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-red-600 px-2 py-1.5 rounded-lg"
              >
                <TrashIcon size={14} /> Discard
              </button>
              <Link
                href="/dashboard/practice/run"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg"
              >
                Resume <ArrowRightIcon size={12} />
              </Link>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">University (optional)</label>
            <SearchSelect
              options={universityOptions}
              value={school}
              onChange={(v) => { setSchool(v); setCourseId(''); }}
              placeholder="Search universities…"
              emptyText="No matching universities"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Course</label>
            <SearchSelect
              options={courseOptions}
              value={courseId}
              onChange={setCourseId}
              placeholder="Any course"
              emptyText="No matching courses"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Question type</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'all', label: 'Both' },
                { value: 'mcq', label: 'MCQ only' },
                { value: 'theory', label: 'Theory only' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setQuestionType(opt.value)}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    questionType === opt.value
                      ? 'border-green-400 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/40 dark:text-green-400'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Number of questions</label>
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
                { value: 'at_end', title: 'At the end', desc: 'Sit it like a real exam — score and review after finishing.' },
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
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
          >
            <PlayIcon size={14} />
            {loading ? 'Starting…' : paused ? 'Start a new exam' : 'Start exam'}
          </button>
        </div>
      </div>
    </div>
  );
}
