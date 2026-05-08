'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

interface Upload {
  id: string;
  file_name: string;
  file_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
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

  const limit = 20;

  async function loadUploads(p: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/uploads?page=${p}&limit=${limit}`);
      if (!res.ok) {
        window.location.href = '/login';
        return;
      }
      const json = await res.json();
      setUploads(json.data ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUploads(page);
  }, [page]);

  useEffect(() => {
    async function loadCourses() {
      const res = await fetch('/api/courses?limit=200');
      if (res.ok) {
        const json = await res.json();
        setCourses(json.data ?? []);
      }
    }
    loadCourses();
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;
    setUploadError('');
    setUploadSuccess('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      if (selectedCourse) fd.append('course_id', selectedCourse);
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

  const statusBadge = (status: Upload['status']) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
      processing: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
      completed: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
      failed: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    };
    return map[status] ?? 'bg-zinc-100 text-zinc-600';
  };

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Course</label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select course (optional)</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>
                  ))}
                </select>
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
              {uploads.map((u) => (
                <div key={u.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-900 dark:text-white font-medium truncate">{u.file_name}</div>
                    <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{new Date(u.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                      {u.courses && <span>· {u.courses.name}{u.courses.code ? ` (${u.courses.code})` : ''}</span>}
                      {u.questions_extracted > 0 && <span>· {u.questions_extracted} questions extracted</span>}
                    </div>
                  </div>
                  <span className={`shrink-0 px-2 py-1 rounded text-xs font-medium capitalize ${statusBadge(u.status)}`}>
                    {u.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-zinc-400">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
