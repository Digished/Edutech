'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

interface Upload {
  id: string;
  original_name: string | null;
  file_type: string;
  processed: boolean;
  processing_error: string | null;
  questions_extracted: number;
  created_at: string;
  courses: { name: string; code: string | null } | null;
}

interface Course {
  id: string;
  name: string;
  code: string | null;
  school: string;
  department: string;
}

interface University { id: string; name: string }
interface Department { id: string; name: string; university_id: string }

export default function UploadsPage() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [year, setYear] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline course creation
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [courseForm, setCourseForm] = useState({ name: '', code: '', school: '', department: '' });
  const [courseLoading, setCourseLoading] = useState(false);
  const [courseError, setCourseError] = useState('');
  const [universities, setUniversities] = useState<University[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const limit = 20;

  async function loadUploads(p: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/uploads?page=${p}&limit=${limit}`);
      if (res.status === 401) { window.location.href = '/login'; return; }
      const json = await res.json();
      setUploads(json.data ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  async function loadCourses() {
    const res = await fetch('/api/courses?limit=200');
    if (res.ok) {
      const json = await res.json();
      setCourses(json.data ?? []);
    }
  }

  useEffect(() => { loadUploads(page); }, [page]);
  useEffect(() => { loadCourses(); }, []);

  useEffect(() => {
    fetch('/api/universities').then(async (r) => {
      const j = await r.json();
      setUniversities(j.data ?? []);
    });
  }, []);

  useEffect(() => {
    if (!courseForm.school) { setDepartments([]); return; }
    fetch(`/api/departments?university=${encodeURIComponent(courseForm.school)}`).then(async (r) => {
      const j = await r.json();
      setDepartments(j.data ?? []);
    });
  }, [courseForm.school]);

  async function handleAddCourse(e: React.FormEvent) {
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
        setCourseError(json.error ?? 'Failed to create course');
        return;
      }
      const newCourse = json.data as Course;
      setCourses((prev) => [...prev, newCourse]);
      setSelectedCourse(newCourse.id);
      setCourseForm({ name: '', code: '', school: '', department: '' });
      setShowAddCourse(false);
    } finally {
      setCourseLoading(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;
    if (!selectedCourse) { setUploadError('Please select a course before uploading.'); return; }
    setUploadError('');
    setUploadSuccess('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('course_id', selectedCourse);
      if (year) fd.append('year', year);

      const res = await fetch('/api/uploads', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error ?? 'Upload failed');
        return;
      }
      setUploadSuccess('File uploaded successfully. Questions will be extracted shortly.');
      setSelectedFile(null);
      setSelectedCourse('');
      setYear('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadUploads(1);
      setPage(1);
    } finally {
      setUploading(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  function getUploadStatus(u: Upload): { label: string; cls: string } {
    if (u.processing_error) return { label: 'Failed', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' };
    if (u.processed) return { label: 'Completed', cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' };
    return { label: 'Processing', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400' };
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors">
            ← Dashboard
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-green-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">E</span>
            </div>
            <span className="font-semibold text-zinc-900 dark:text-white text-sm">EduTech</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Upload past papers</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Upload a PDF or image of a past exam paper to extract questions automatically
          </p>
        </div>

        {uploadSuccess && (
          <div className="mb-6 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm px-4 py-3 rounded-lg">
            {uploadSuccess}
          </div>
        )}

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 mb-8">
          <h2 className="font-semibold text-zinc-900 dark:text-white text-sm mb-4">New upload</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            {uploadError && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
                {uploadError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                File <span className="text-red-500">*</span>
                <span className="ml-2 text-xs font-normal text-zinc-400">PDF, JPG, PNG — max 20MB</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                required
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-green-50 file:text-green-700 dark:file:bg-green-950 dark:file:text-green-400 file:text-xs file:font-medium"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
              <select
                required
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select a course…</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.code ? ` (${c.code})` : ''} — {c.school}
                  </option>
                ))}
              </select>

              {/* Inline course creation */}
              {showAddCourse && (
                <div className="mt-3 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-3">New course</p>
                  {courseError && (
                    <p className="text-xs text-red-600 dark:text-red-400 mb-2">{courseError}</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required={showAddCourse}
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
                    {universities.length > 0 ? (
                      <select
                        required={showAddCourse}
                        value={courseForm.school}
                        onChange={(e) => setCourseForm((f) => ({ ...f, school: e.target.value, department: '' }))}
                        className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">University *</option>
                        {universities.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required={showAddCourse}
                        value={courseForm.school}
                        onChange={(e) => setCourseForm((f) => ({ ...f, school: e.target.value }))}
                        placeholder="University *"
                        className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    )}
                    {departments.length > 0 ? (
                      <select
                        required={showAddCourse}
                        value={courseForm.department}
                        onChange={(e) => setCourseForm((f) => ({ ...f, department: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Department *</option>
                        {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required={showAddCourse}
                        value={courseForm.department}
                        onChange={(e) => setCourseForm((f) => ({ ...f, department: e.target.value }))}
                        placeholder="Department *"
                        className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    )}
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
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Year</label>
              <input
                type="number"
                min={1990}
                max={new Date().getFullYear()}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder={`e.g. ${new Date().getFullYear() - 1}`}
                className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
            >
              {uploading ? 'Uploading…' : 'Upload paper'}
            </button>
          </form>
        </div>

        {/* Upload history */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="font-semibold text-zinc-900 dark:text-white text-sm">My uploads ({total})</h2>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : uploads.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
              <div className="text-3xl mb-2">📤</div>
              <p className="text-sm">No uploads yet</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {uploads.map((u) => {
                const s = getUploadStatus(u);
                return (
                  <div key={u.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm text-zinc-900 dark:text-white font-medium truncate">
                        {u.original_name ?? 'Unnamed file'}
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{new Date(u.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        {u.courses && <span>· {u.courses.name}{u.courses.code ? ` (${u.courses.code})` : ''}</span>}
                        {u.questions_extracted > 0 && <span>· {u.questions_extracted} questions extracted</span>}
                        {u.processing_error && <span className="text-red-400">· {u.processing_error}</span>}
                      </div>
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded text-xs font-medium ${s.cls}`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
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
    </div>
  );
}
