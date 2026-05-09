'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon, ArrowRightIcon, CheckIcon, FlaskIcon, LockIcon, PlayIcon, SparklesIcon, TrashIcon,
} from '@/components/icons';
import { Brand } from '@/components/Logo';

interface Course {
  id: string;
  name: string;
  school: string;
  department: string;
  code: string | null;
}

interface PausedSummary { total: number; answered: number }

interface UnlockedDept {
  id: string;
  school: string;
  department: string;
}

interface Status {
  is_admin: boolean;
  unlocked_departments: UnlockedDept[];
}

const MAX_COUNT = 50;
const DEFAULT_COUNT = 10;

export default function PracticeSetupPage() {
  const router = useRouter();
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [school, setSchool] = useState('');
  const [department, setDepartment] = useState('');
  const [pickedCourseIds, setPickedCourseIds] = useState<string[]>([]);
  const [questionType, setQuestionType] = useState<'mcq' | 'theory' | 'all'>('all');
  const [reveal, setReveal] = useState<'after_each' | 'at_end'>('at_end');
  const [countStr, setCountStr] = useState(String(DEFAULT_COUNT));
  const [available, setAvailable] = useState<number | null>(null);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [paused, setPaused] = useState<PausedSummary | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, c] = await Promise.all([
        fetch('/api/contributor-status'),
        fetch('/api/courses?limit=500'),
      ]);
      if (cancelled) return;
      if (s.status === 401) { window.location.href = '/login?next=/dashboard/practice'; return; }
      if (s.ok) { const j = await s.json(); setStatus(j.data); }
      if (c.ok) { const j = await c.json(); setAllCourses(j.data ?? []); }
      setStatusLoading(false);

      const raw = sessionStorage.getItem('practice_session');
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { ids: string[]; answers: Record<string, string> };
          if (parsed.ids?.length) {
            const answered = Object.values(parsed.answers ?? {}).filter((v) => v && v.trim()).length;
            setPaused({ total: parsed.ids.length, answered });
          }
        } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isAdmin = !!status?.is_admin;
  const unlocked = status?.unlocked_departments ?? [];

  // Courses limited to those in unlocked departments (admins see all).
  const accessibleCourses = useMemo(() => {
    if (isAdmin) return allCourses;
    if (unlocked.length === 0) return [];
    const set = new Set(unlocked.map((u) => `${u.school}::${u.department}`));
    return allCourses.filter((c) => set.has(`${c.school}::${c.department}`));
  }, [allCourses, isAdmin, unlocked]);

  const schools = useMemo(() => {
    return Array.from(new Set(accessibleCourses.map((c) => c.school))).sort();
  }, [accessibleCourses]);
  const departments = useMemo(() => {
    if (!school) return [] as string[];
    return Array.from(new Set(accessibleCourses.filter((c) => c.school === school).map((c) => c.department))).sort();
  }, [accessibleCourses, school]);

  const filteredCourses = useMemo(() => {
    return accessibleCourses
      .filter((c) => (school ? c.school === school : true))
      .filter((c) => (department ? c.department === department : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [accessibleCourses, school, department]);

  // Drop picks that no longer match the filters.
  useEffect(() => {
    const ok = new Set(filteredCourses.map((c) => c.id));
    setPickedCourseIds((arr) => arr.filter((id) => ok.has(id)));
  }, [filteredCourses]);

  // Live cap from the server.
  useEffect(() => {
    let cancelled = false;
    if (statusLoading) return;
    setAvailableLoading(true);
    const params = new URLSearchParams();
    if (pickedCourseIds.length > 0) params.set('course_ids', pickedCourseIds.join(','));
    if (questionType !== 'all') params.set('question_type', questionType);
    fetch(`/api/practice/available-count?${params}`).then(async (r) => {
      if (cancelled) return;
      if (r.ok) {
        const j = await r.json();
        setAvailable(typeof j.data?.total === 'number' ? j.data.total : 0);
      } else {
        setAvailable(0);
      }
      setAvailableLoading(false);
    });
    return () => { cancelled = true; };
  }, [pickedCourseIds, questionType, statusLoading]);

  const cap = available ?? 0;
  const requestedCount = Math.max(0, Math.min(MAX_COUNT, parseInt(countStr || '0', 10) || 0));
  const effectiveCount = Math.min(requestedCount, cap);

  function handleCountChange(v: string) {
    // Strip leading zeros and any non-digit so the field can never sit at "0…".
    const digits = v.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    if (digits === '') { setCountStr(''); return; }
    const n = parseInt(digits, 10);
    setCountStr(String(Math.min(n, MAX_COUNT)));
  }

  function toggleCourse(id: string) {
    setPickedCourseIds((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  }

  function selectAll() { setPickedCourseIds(filteredCourses.map((c) => c.id)); }
  function clearAll() { setPickedCourseIds([]); }
  function discardPaused() { sessionStorage.removeItem('practice_session'); setPaused(null); }

  async function start() {
    setError('');
    if (effectiveCount < 1) { setError('Pick at least one question.'); return; }
    setStarting(true);
    try {
      const params = new URLSearchParams({ limit: String(effectiveCount) });
      if (pickedCourseIds.length === 1) params.set('course_id', pickedCourseIds[0]);
      if (questionType !== 'all') params.set('question_type', questionType);
      const res = await fetch(`/api/questions?${params}&page=1`);
      const json = await res.json();
      let ids: string[] = (json.data ?? []).map((q: { id: string }) => q.id);
      if (pickedCourseIds.length > 1) {
        // Multi-course: pull from each selected course and merge.
        const merged: string[] = [];
        for (const cid of pickedCourseIds) {
          const p2 = new URLSearchParams({ limit: String(effectiveCount), course_id: cid });
          if (questionType !== 'all') p2.set('question_type', questionType);
          const r = await fetch(`/api/questions?${p2}&page=1`);
          if (r.ok) {
            const jj = await r.json();
            for (const q of jj.data ?? []) merged.push(q.id);
          }
        }
        ids = Array.from(new Set(merged));
      }
      if (ids.length === 0) { setError('No questions match these filters.'); return; }
      // Shuffle and trim.
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      ids = ids.slice(0, effectiveCount);

      const session = {
        ids,
        answers: {} as Record<string, string>,
        startedAt: Date.now(),
        courseId: pickedCourseIds.length === 1 ? pickedCourseIds[0] : null,
        reveal,
      };
      sessionStorage.setItem('practice_session', JSON.stringify(session));
      router.push('/dashboard/practice/run?i=0');
    } catch {
      setError('Could not start. Try again.');
    } finally {
      setStarting(false);
    }
  }

  const hasAnyAccess = isAdmin || unlocked.length > 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
            <ArrowLeftIcon size={14} /> Dashboard
          </Link>
          <Brand size="sm" href="/dashboard" />
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 flex items-center justify-center">
              <FlaskIcon size={18} />
            </span>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Practice exam</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">One question per page · pause anytime</p>
            </div>
          </div>
          <Link
            href="/dashboard/practice/history"
            className="text-xs px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg inline-flex items-center gap-1.5"
          >
            <ArrowRightIcon size={12} /> View past exams
          </Link>
        </div>

        {paused && (
          <div className="mb-5 bg-white dark:bg-zinc-900 border border-green-200 dark:border-green-900 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-green-600 text-white flex items-center justify-center">
                <PlayIcon size={16} />
              </span>
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-white">Paused exam available</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{paused.answered} of {paused.total} answered</div>
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

        {!hasAnyAccess && !statusLoading && (
          <div className="mb-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 text-center">
            <span className="inline-flex w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 items-center justify-center mb-2">
              <LockIcon size={16} />
            </span>
            <h2 className="font-semibold text-zinc-900 dark:text-white text-sm">Unlock a department to practice</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
              Practice exams pull from departments you&apos;ve subscribed to.
            </p>
            <Link
              href="/dashboard/subscription"
              className="mt-4 inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              <SparklesIcon size={14} /> See subscriptions
            </Link>
          </div>
        )}

        {hasAnyAccess && (
          <>
            {error && (
              <div className="mb-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-5">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">University (optional filter)</label>
                <select
                  value={school}
                  onChange={(e) => { setSchool(e.target.value); setDepartment(''); }}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Any unlocked university</option>
                  {schools.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {school && (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Department (optional filter)</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Any unlocked department</option>
                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">Courses</label>
                  <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                    <button type="button" onClick={selectAll} className="hover:text-green-600">Select all</button>
                    <button type="button" onClick={clearAll} className="hover:text-zinc-700 dark:hover:text-zinc-200">Clear</button>
                  </div>
                </div>
                {filteredCourses.length === 0 ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">No courses available for these filters.</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredCourses.map((c) => {
                      const checked = pickedCourseIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors ${
                            checked ? 'bg-green-50 dark:bg-green-950/40' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="accent-green-600"
                            checked={checked}
                            onChange={() => toggleCourse(c.id)}
                          />
                          <span className="flex-1 min-w-0 text-zinc-900 dark:text-white truncate">
                            {c.name}{c.code ? ` (${c.code})` : ''}
                          </span>
                          <span className="shrink-0 text-[11px] text-zinc-400">{c.department}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {pickedCourseIds.length === 0
                    ? 'Pulling from all your unlocked courses.'
                    : `${pickedCourseIds.length} course${pickedCourseIds.length === 1 ? '' : 's'} selected`}
                </div>
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
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={countStr}
                    onChange={(e) => handleCountChange(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => {
                      if (!countStr || parseInt(countStr, 10) < 1) setCountStr(String(Math.min(DEFAULT_COUNT, cap || DEFAULT_COUNT)));
                    }}
                    placeholder="e.g. 10"
                    className="w-24 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {availableLoading
                      ? 'Counting available questions…'
                      : `${cap.toLocaleString()} available · max ${MAX_COUNT}`}
                  </span>
                </div>
                {requestedCount > cap && cap > 0 && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                    Only {cap} match these filters — we&apos;ll cap your exam at {cap}.
                  </p>
                )}
                {cap === 0 && !availableLoading && (
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    No questions match these filters. Try a different course or question type.
                  </p>
                )}
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
                disabled={starting || effectiveCount < 1}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
              >
                <PlayIcon size={14} />
                {starting ? 'Starting…' : effectiveCount < 1 ? 'Pick a few questions to start' : `Start exam (${effectiveCount})`}
              </button>
              {requestedCount > 0 && requestedCount !== effectiveCount && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-1.5">
                  <CheckIcon size={12} /> Capped to what&apos;s available.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
