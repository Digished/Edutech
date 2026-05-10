'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SearchSelect from '@/components/SearchSelect';
import ImageUploader from '@/components/ImageUploader';
import {
  ArrowLeftIcon, CheckIcon, PenIcon, PlusIcon, SparklesIcon, TrashIcon, XIcon,
} from '@/components/icons';
import { Brand } from '@/components/Logo';

interface Course {
  id: string;
  name: string;
  school: string;
  department: string;
  code: string | null;
}

interface University { id: string; name: string }
interface Faculty   { id: string; name: string; university_id: string }
interface Department { id: string; name: string; faculty_id: string }

type QType = 'mcq' | 'theory';

interface Suggestion {
  correct_answer: string;
  explanation: string;
  confidence: 'low' | 'medium' | 'high';
}

const DEFAULT_OPTIONS = ['A', 'B', 'C', 'D'];

export default function NewQuestionPage() {
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');

  // Inline course creation — mirrors /dashboard/uploads.
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [courseForm, setCourseForm] = useState({
    name: '', code: '', school: '', faculty: '', department: '',
  });
  const [courseLoading, setCourseLoading] = useState(false);
  const [courseError, setCourseError] = useState('');
  const [universities, setUniversities] = useState<University[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [questionText, setQuestionText] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [level, setLevel] = useState<number | ''>('');
  const [semester, setSemester] = useState<number | ''>('');
  const [questionType, setQuestionType] = useState<QType>('mcq');
  const [options, setOptions] = useState<{ key: string; value: string }[]>(
    DEFAULT_OPTIONS.map((k) => ({ key: k, value: '' })),
  );
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [referenceAnswer, setReferenceAnswer] = useState('');

  const [imageUrls, setImageUrls] = useState<string[]>([]);

  // Multi-part theory state — only used when questionType === 'theory' AND
  // the contributor toggles "This question has multiple sub-parts".
  const [multiPart, setMultiPart] = useState(false);
  const [stem, setStem] = useState('');
  const [stemImageUrls, setStemImageUrls] = useState<string[]>([]);
  type Part = { part_label: string; question_text: string; correct_answer: string };
  const [parts, setParts] = useState<Part[]>([
    { part_label: 'a', question_text: '', correct_answer: '' },
    { part_label: 'b', question_text: '', correct_answer: '' },
  ]);
  function updatePart(i: number, patch: Partial<Part>) {
    setParts((arr) => arr.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function addPart() {
    const labels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const next = labels[parts.length] ?? String(parts.length + 1);
    setParts((arr) => [...arr, { part_label: next, question_text: '', correct_answer: '' }]);
  }
  function removePart(i: number) {
    setParts((arr) => (arr.length <= 1 ? arr : arr.filter((_, idx) => idx !== i)));
  }

  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggestError, setSuggestError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  async function loadCourses() {
    const r = await fetch('/api/courses?limit=200');
    if (r.ok) { const j = await r.json(); setCourses(j.data ?? []); }
  }
  useEffect(() => { loadCourses(); }, []);

  useEffect(() => {
    fetch('/api/universities').then(async (r) => {
      const j = await r.json();
      setUniversities(j.data ?? []);
    });
  }, []);

  // Cascade: school -> faculties; faculty -> departments.
  useEffect(() => {
    if (!courseForm.school) { setFaculties([]); return; }
    fetch(`/api/faculties?university=${encodeURIComponent(courseForm.school)}`).then(async (r) => {
      const j = await r.json();
      setFaculties(j.data ?? []);
    });
  }, [courseForm.school]);

  useEffect(() => {
    if (!courseForm.faculty) { setDepartments([]); return; }
    const facultyRow = faculties.find((f) => f.name === courseForm.faculty);
    if (!facultyRow) { setDepartments([]); return; }
    fetch(`/api/departments?faculty_id=${facultyRow.id}`).then(async (r) => {
      const j = await r.json();
      setDepartments(j.data ?? []);
    });
  }, [courseForm.faculty, faculties]);

  async function handleAddCourse(e: React.MouseEvent) {
    e.preventDefault();
    setCourseError('');
    setCourseLoading(true);
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courseForm),
      });
      const json = await res.json();
      if (!res.ok) {
        setCourseError(json.error ?? 'Could not create the course.');
        return;
      }
      const newCourse = json.data as Course;
      setCourses((prev) => [...prev, newCourse]);
      setCourseId(newCourse.id);
      setCourseForm({ name: '', code: '', school: '', faculty: '', department: '' });
      setShowAddCourse(false);
    } finally {
      setCourseLoading(false);
    }
  }

  function updateOption(idx: number, value: string) {
    setOptions((arr) => arr.map((o, i) => (i === idx ? { ...o, value } : o)));
  }

  function addOption() {
    if (options.length >= 6) return;
    const nextLetter = String.fromCharCode(65 + options.length);
    setOptions((arr) => [...arr, { key: nextLetter, value: '' }]);
  }

  function removeOption(idx: number) {
    if (options.length <= 2) return;
    setOptions((arr) => arr.filter((_, i) => i !== idx).map((o, i) => ({ ...o, key: String.fromCharCode(65 + i) })));
    if (correctAnswer && !options.filter((_, i) => i !== idx).some((o) => o.key === correctAnswer)) {
      setCorrectAnswer('');
    }
  }

  function buildOptionsObject() {
    const out: Record<string, string> = {};
    for (const { key, value } of options) {
      const trimmed = value.trim();
      if (trimmed) out[key] = trimmed;
    }
    return out;
  }

  async function handleSuggest() {
    setSuggestError('');
    setSuggestion(null);
    if (!questionText.trim()) {
      setSuggestError('Write the question first');
      return;
    }
    setSuggesting(true);
    try {
      const payload: Record<string, unknown> = {
        question_text: questionText,
        question_type: questionType,
      };
      if (questionType === 'mcq') payload.options = buildOptionsObject();
      const res = await fetch('/api/questions/suggest-answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setSuggestError(json.error ?? 'Could not suggest an answer');
        return;
      }
      setSuggestion(json.data);
    } catch {
      setSuggestError('Network error');
    } finally {
      setSuggesting(false);
    }
  }

  function applySuggestion() {
    if (!suggestion) return;
    if (questionType === 'mcq') {
      setCorrectAnswer(suggestion.correct_answer);
    } else {
      setReferenceAnswer(suggestion.correct_answer);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    if (!courseId) { setSubmitError('Pick a course'); return; }

    const isMulti = questionType === 'theory' && multiPart;
    if (isMulti) {
      if (!stem.trim()) { setSubmitError('Write the shared heading / stem'); return; }
      const cleanParts = parts.filter((p) => p.question_text.trim());
      if (cleanParts.length < 1) { setSubmitError('Add at least one sub-part'); return; }
    } else {
      if (!questionText.trim()) { setSubmitError('Write the question'); return; }
    }

    const opts = buildOptionsObject();
    if (!isMulti && questionType === 'mcq' && Object.keys(opts).length < 2) {
      setSubmitError('Add at least two options');
      return;
    }
    if (!isMulti && questionType === 'mcq' && correctAnswer && !opts[correctAnswer]) {
      setSubmitError('Correct answer must match one of your options');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        course_id: courseId,
        question_type: questionType,
        year: year === '' ? null : Number(year),
        level: level === '' ? null : Number(level),
        semester: semester === '' ? null : Number(semester),
      };
      if (isMulti) {
        payload.stem = stem.trim();
        payload.stem_image_urls = stemImageUrls;
        payload.parts = parts
          .filter((p) => p.question_text.trim())
          .map((p) => ({
            part_label: p.part_label.trim() || undefined,
            question_text: p.question_text.trim(),
            correct_answer: p.correct_answer.trim() || null,
          }));
      } else {
        payload.question_text = questionText.trim();
        payload.image_urls = imageUrls;
        if (questionType === 'mcq') {
          payload.options = opts;
          if (correctAnswer) payload.correct_answer = correctAnswer;
        } else {
          if (referenceAnswer.trim()) payload.correct_answer = referenceAnswer.trim();
        }
      }
      const res = await fetch('/api/questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error ?? 'Could not submit');
        return;
      }
      setSubmitSuccess(true);
      setTimeout(() => router.push('/dashboard/contributions'), 900);
    } catch {
      setSubmitError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  const courseOptions = courses.map((c) => ({
    value: c.id,
    label: `${c.name}${c.code ? ` (${c.code})` : ''}`,
    hint: c.school,
  }));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/dashboard/contributions" className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white inline-flex items-center gap-1.5 transition-colors">
            <ArrowLeftIcon size={14} /> Contributions
          </Link>
          <Brand size="sm" href="/dashboard" />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 flex items-center justify-center">
            <PenIcon size={18} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Add a question</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Submitted questions are reviewed before they go live</p>
          </div>
        </div>

        {submitSuccess && (
          <div className="mb-5 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm px-4 py-3 rounded-lg">
            Submitted for admin review. You&apos;ll be notified once it&apos;s approved. Redirecting…
          </div>
        )}

        {submitError && (
          <div className="mb-5 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Course <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowAddCourse((v) => !v)}
                className="text-xs text-green-600 hover:text-green-700 font-medium"
              >
                {showAddCourse ? 'Cancel' : '+ Add new course'}
              </button>
            </div>
            <SearchSelect
              options={courseOptions}
              value={courseId}
              onChange={setCourseId}
              placeholder="Pick a course"
              emptyText="No matching courses"
            />

            {showAddCourse && (
              <div className="mt-3 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-3">New course</p>
                {courseError && (
                  <p className="text-xs text-red-600 dark:text-red-400 mb-2">{courseError}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={courseForm.name}
                    onChange={(e) => setCourseForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Course name *"
                    className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="text"
                    value={courseForm.code}
                    onChange={(e) => setCourseForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="Course code (e.g. CSC301)"
                    className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <select
                    value={courseForm.school}
                    onChange={(e) => setCourseForm((f) => ({ ...f, school: e.target.value, faculty: '', department: '' }))}
                    className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">University *</option>
                    {universities.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                  </select>
                  <select
                    value={courseForm.faculty}
                    onChange={(e) => setCourseForm((f) => ({ ...f, faculty: e.target.value, department: '' }))}
                    disabled={!courseForm.school}
                    className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60"
                  >
                    <option value="">Faculty *</option>
                    {faculties.map((f) => <option key={f.id} value={f.name}>{f.name}</option>)}
                  </select>
                  <select
                    value={courseForm.department}
                    onChange={(e) => setCourseForm((f) => ({ ...f, department: e.target.value }))}
                    disabled={!courseForm.faculty}
                    className="sm:col-span-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60"
                  >
                    <option value="">Department *</option>
                    {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={courseLoading}
                  onClick={handleAddCourse}
                  className="mt-3 px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  {courseLoading ? 'Creating…' : 'Create course'}
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Question type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['mcq', 'theory'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setQuestionType(t)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    questionType === t
                      ? 'border-green-400 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/40 dark:text-green-400'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {t === 'mcq' ? 'Multiple choice' : 'Theory / essay'}
                </button>
              ))}
            </div>
          </div>

          {questionType === 'theory' && (
            <label className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={multiPart}
                onChange={(e) => setMultiPart(e.target.checked)}
                className="mt-0.5 accent-green-600"
              />
              <span>
                <span className="font-medium">This question has multiple sub-parts</span>
                <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  e.g. a heading like &quot;Given the model ABC&quot; followed by (a), (b), (c). Each sub-part is graded
                  on its own but shares the same heading.
                </span>
              </span>
            </label>
          )}

          {!multiPart && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Question text</label>
              <textarea
                required
                rows={4}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Type or paste the full question…"
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}

          {multiPart && questionType === 'theory' && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Shared heading / stem <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={stem}
                  onChange={(e) => setStem(e.target.value)}
                  placeholder="e.g. Given the model ABC..."
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Shown once above every sub-part. Don&apos;t repeat it inside each part.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Heading images <span className="text-zinc-400 font-normal">(optional, e.g. a diagram referenced by all parts)</span>
                </label>
                <ImageUploader
                  value={stemImageUrls}
                  onChange={setStemImageUrls}
                  hint="Up to 8 images, 5MB each."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Sub-parts</label>
                  <button
                    type="button"
                    onClick={addPart}
                    disabled={parts.length >= 8}
                    className="text-xs text-green-600 hover:text-green-700 inline-flex items-center gap-1 disabled:opacity-40"
                  >
                    <PlusIcon size={12} /> Add part
                  </button>
                </div>
                <div className="space-y-3">
                  {parts.map((p, i) => (
                    <div key={i} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50/40 dark:bg-zinc-900/40">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          value={p.part_label}
                          onChange={(e) => updatePart(i, { part_label: e.target.value })}
                          placeholder="a"
                          className="w-14 px-2 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-medium text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">part label</span>
                        {parts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePart(i)}
                            className="ml-auto text-zinc-400 hover:text-red-500"
                            title="Remove part"
                          >
                            <TrashIcon size={14} />
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={2}
                        value={p.question_text}
                        onChange={(e) => updatePart(i, { question_text: e.target.value })}
                        placeholder="Sub-part question, e.g. Define AB."
                        className="w-full px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <textarea
                        rows={2}
                        value={p.correct_answer}
                        onChange={(e) => updatePart(i, { correct_answer: e.target.value })}
                        placeholder="Reference answer (optional, used by AI grader)"
                        className="w-full mt-2 px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {!multiPart && questionType === 'mcq' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Options</label>
                <button
                  type="button"
                  onClick={addOption}
                  disabled={options.length >= 6}
                  className="text-xs text-green-600 hover:text-green-700 inline-flex items-center gap-1 disabled:opacity-40"
                >
                  <PlusIcon size={12} /> Add option
                </button>
              </div>
              <div className="space-y-2">
                {options.map((o, i) => {
                  const picked = correctAnswer === o.key;
                  return (
                    <div key={o.key} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors ${
                      picked ? 'border-green-400 bg-green-50/40 dark:border-green-700 dark:bg-green-950/30' : 'border-zinc-200 dark:border-zinc-700'
                    }`}>
                      <button
                        type="button"
                        onClick={() => setCorrectAnswer(picked ? '' : o.key)}
                        className={`w-7 h-7 rounded-md text-xs font-bold flex items-center justify-center shrink-0 ${
                          picked ? 'bg-green-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                        }`}
                        title={picked ? 'Marked as correct' : 'Mark as correct'}
                      >
                        {picked ? <CheckIcon size={14} /> : o.key}
                      </button>
                      <input
                        value={o.value}
                        onChange={(e) => updateOption(i, e.target.value)}
                        placeholder={`Option ${o.key}`}
                        className="flex-1 px-2 py-1.5 rounded-md bg-transparent text-sm text-zinc-900 dark:text-white focus:outline-none"
                      />
                      {options.length > 2 && (
                        <button type="button" onClick={() => removeOption(i)} className="text-zinc-400 hover:text-red-500 shrink-0" title="Remove option">
                          <TrashIcon size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">Click the letter to mark the correct option.</p>
            </div>
          )}

          {!multiPart && questionType === 'theory' && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Reference answer <span className="text-zinc-400 font-normal">(optional, used by AI grader)</span>
              </label>
              <textarea
                rows={3}
                value={referenceAnswer}
                onChange={(e) => setReferenceAnswer(e.target.value)}
                placeholder="A short ideal answer / key marking points…"
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}

          {/* AI suggest answer — single-question mode only. */}
          {!multiPart && (
          <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                <SparklesIcon size={14} className="text-green-600" />
                <span className="font-medium">Need help marking the answer?</span>
              </div>
              <button
                type="button"
                onClick={handleSuggest}
                disabled={suggesting}
                className="text-xs px-3 py-1.5 rounded-lg border border-green-300 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 disabled:opacity-60"
              >
                {suggesting ? 'Asking AI…' : 'Suggest answer'}
              </button>
            </div>
            {suggestError && (
              <div className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <XIcon size={12} /> {suggestError}
              </div>
            )}
            {suggestion && (
              <div className="mt-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-zinc-900 dark:text-white">Suggested:</span>
                  <code className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 text-zinc-800 dark:text-zinc-200">
                    {suggestion.correct_answer || '—'}
                  </code>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-semibold ${
                    suggestion.confidence === 'high' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' :
                    suggestion.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400' :
                    'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}>
                    {suggestion.confidence}
                  </span>
                  <button
                    type="button"
                    onClick={applySuggestion}
                    className="ml-auto text-green-700 dark:text-green-400 hover:underline"
                  >
                    Use this
                  </button>
                </div>
                {suggestion.explanation && (
                  <p className="mt-2 text-zinc-600 dark:text-zinc-400 leading-relaxed">{suggestion.explanation}</p>
                )}
              </div>
            )}
          </div>
          )}

          {!multiPart && (
            <ImageUploader
              value={imageUrls}
              onChange={setImageUrls}
              label="Images (optional)"
              hint="Attach diagrams, charts or any image the question refers to. Up to 8 images, 5MB each."
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Level</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Any</option>
                {[100, 200, 300, 400, 500, 600].map((l) => <option key={l} value={l}>{l} level</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Semester</label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Any</option>
                {[1, 2, 3].map((s) => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Year</label>
              <input
                type="number" min={1990} max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 2023"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm"
          >
            {submitting ? 'Adding…' : 'Add to question bank'}
          </button>
        </form>
      </div>
    </div>
  );
}
