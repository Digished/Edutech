'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/icons';

interface Extraction {
  id: string;
  upload_id: string;
  position: number;
  question_text: string;
  question_type: 'mcq' | 'theory';
  options: Record<string, string> | null;
  correct_answer: string | null;
  year: number | null;
  is_duplicate: boolean;
  duplicate_of: string | null;
  excluded: boolean;
  confirmed: boolean;
}

interface UploadInfo {
  id: string;
  user_id: string;
  course_id: string;
  processing_stage: string | null;
  processing_error: string | null;
  needs_review: boolean;
}

export default function ReviewExtractionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [upload, setUpload] = useState<UploadInfo | null>(null);
  const [items, setItems] = useState<Extraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ published: number; skipped: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/uploads/${id}/extractions`);
      if (res.status === 401) { window.location.href = `/login?next=/dashboard/uploads/${id}/review`; return; }
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Failed to load extractions'); return; }
      setUpload(json.data?.upload ?? null);
      setItems(json.data?.extractions ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function patchLocal(extId: string, patch: Partial<Extraction>) {
    setItems((prev) => prev.map((e) => (e.id === extId ? { ...e, ...patch } : e)));
  }

  async function save(extId: string, patch: Partial<Extraction>) {
    setSavingId(extId);
    try {
      const res = await fetch(`/api/uploads/${id}/extractions/${extId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (res.ok) patchLocal(extId, json.data);
    } finally {
      setSavingId(null);
    }
  }

  async function confirmAll() {
    if (confirming || done) return;
    setConfirming(true);
    setError('');
    setConfirmOpen(false);
    try {
      const res = await fetch(`/api/uploads/${id}/confirm`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not publish'); return; }
      setDone({ published: json.data?.published ?? 0, skipped: json.data?.skipped ?? 0 });
    } finally {
      setConfirming(false);
    }
  }

  const willPublish = items.filter((e) => !e.excluded && !e.is_duplicate && !e.confirmed).length;
  const dupCount = items.filter((e) => e.is_duplicate).length;
  const exclCount = items.filter((e) => e.excluded).length;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard/uploads" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
            <ArrowLeftIcon size={14} /> Uploads
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-green-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">E</span>
            </div>
            <span className="font-semibold text-zinc-900 dark:text-white text-sm">EduTech</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Review extracted questions</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Edit anything you need to fix, drop questions you don&apos;t want to publish, then click Confirm.
            Duplicates of questions already in the bank are skipped automatically.
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {done && (
          <div className="mb-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm px-4 py-3 rounded-lg">
            Published {done.published} question{done.published === 1 ? '' : 's'}.
            {done.skipped ? ` ${done.skipped} skipped.` : ''}{' '}
            <Link href="/questions" className="underline font-medium inline-flex items-center gap-1">View question bank <ArrowRightIcon size={12} /></Link>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {upload?.processing_error
              ? <>Processing failed: {upload.processing_error}</>
              : <>No drafts yet. {upload?.processing_stage && <>Status: {upload.processing_stage}</>}</>}
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mb-4 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
              <span><span className="font-semibold text-zinc-900 dark:text-white">{items.length}</span> extracted</span>
              <span><span className="font-semibold text-green-700 dark:text-green-400">{willPublish}</span> will publish</span>
              <span><span className="font-semibold text-amber-600 dark:text-amber-400">{dupCount}</span> duplicates</span>
              <span><span className="font-semibold text-zinc-700 dark:text-zinc-300">{exclCount}</span> excluded</span>
            </div>

            <div className="space-y-3">
              {items.map((e, idx) => (
                <ExtractionCard
                  key={e.id}
                  index={idx + 1}
                  ext={e}
                  saving={savingId === e.id}
                  onPatchLocal={(p) => patchLocal(e.id, p)}
                  onSave={(p) => save(e.id, p)}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Link
                href="/dashboard/uploads"
                className="px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Save & finish later
              </Link>
              <button
                disabled={confirming || willPublish === 0 || !!done}
                onClick={() => setConfirmOpen(true)}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg"
              >
                {done
                  ? 'Published'
                  : confirming
                  ? 'Publishing…'
                  : `Publish ${willPublish} question${willPublish === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Publish {willPublish} question{willPublish === 1 ? '' : 's'}?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
              These will go live in the question bank immediately. You can&apos;t publish this batch again from this page.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmAll}
                disabled={confirming}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg"
              >
                {confirming ? 'Publishing…' : 'Yes, publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExtractionCard({
  index,
  ext,
  saving,
  onPatchLocal,
  onSave,
}: {
  index: number;
  ext: Extraction;
  saving: boolean;
  onPatchLocal: (p: Partial<Extraction>) => void;
  onSave: (p: Partial<Extraction>) => void;
}) {
  const optKeys = ['A', 'B', 'C', 'D', 'E'];
  const opts = ext.options ?? {};

  function setOption(key: string, value: string) {
    const next = { ...opts, [key]: value };
    onPatchLocal({ options: next });
  }
  function deleteOption(key: string) {
    const next = { ...opts };
    delete next[key];
    onPatchLocal({ options: next });
    if (ext.correct_answer === key) onPatchLocal({ correct_answer: null });
  }

  const willPublish = !ext.excluded && !ext.is_duplicate;

  return (
    <div className={`bg-white dark:bg-zinc-900 border rounded-xl p-5 ${
      ext.excluded
        ? 'border-zinc-200 dark:border-zinc-800 opacity-50'
        : ext.is_duplicate
        ? 'border-amber-200 dark:border-amber-900'
        : 'border-zinc-200 dark:border-zinc-800'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">#{index}</span>
          <select
            value={ext.question_type}
            disabled={saving}
            onChange={(e) => onSave({ question_type: e.target.value as 'mcq' | 'theory' })}
            className="text-xs px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          >
            <option value="mcq">MCQ</option>
            <option value="theory">Theory</option>
          </select>
          {ext.is_duplicate && (
            <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              Duplicate · skipped
            </span>
          )}
          {ext.excluded && (
            <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              Excluded
            </span>
          )}
          {willPublish && (
            <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
              Will publish
            </span>
          )}
        </div>
        <button
          onClick={() => onSave({ excluded: !ext.excluded })}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        >
          {ext.excluded ? 'Include' : 'Exclude'}
        </button>
      </div>

      <textarea
        value={ext.question_text}
        onChange={(e) => onPatchLocal({ question_text: e.target.value })}
        onBlur={() => onSave({ question_text: ext.question_text })}
        rows={Math.max(2, ext.question_text.split('\n').length)}
        className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />

      {ext.question_type === 'theory' && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Suggested answer (optional — shown to students who attempt this question)
          </label>
          <textarea
            value={ext.correct_answer ?? ''}
            onChange={(e) => onPatchLocal({ correct_answer: e.target.value })}
            onBlur={(e) => onSave({ correct_answer: e.target.value || null })}
            rows={4}
            placeholder="Write the model answer or marking guide. Leave blank if you only have the question."
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      )}

      {ext.question_type === 'mcq' && (
        <div className="mt-3 space-y-2">
          {optKeys.map((k) => (
            (opts[k] !== undefined) ? (
              <div key={k} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSave({ correct_answer: ext.correct_answer === k ? null : k })}
                  title="Mark as correct answer"
                  className={`shrink-0 w-7 h-7 rounded-md text-xs font-semibold border ${
                    ext.correct_answer === k
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {k}
                </button>
                <input
                  value={opts[k] ?? ''}
                  onChange={(e) => setOption(k, e.target.value)}
                  onBlur={() => onSave({ options: opts })}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="button"
                  onClick={() => { deleteOption(k); onSave({ options: { ...opts, [k]: undefined } as never }); }}
                  className="text-xs text-zinc-400 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            ) : null
          ))}
          {/* Add a missing option key */}
          {optKeys.filter((k) => opts[k] === undefined).slice(0, 1).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => { setOption(k, ''); }}
              className="text-xs text-green-600 hover:text-green-700 font-medium"
            >
              + Add option {k}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 text-xs">
        <label className="text-zinc-500 dark:text-zinc-400">
          Year{' '}
          <input
            type="number"
            min={1990}
            max={new Date().getFullYear()}
            defaultValue={ext.year ?? ''}
            onBlur={(e) => {
              const v = e.target.value ? parseInt(e.target.value) : null;
              if (v !== ext.year) onSave({ year: v });
            }}
            className="ml-1 w-24 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
          />
        </label>
        {saving && <span className="text-zinc-400">Saving…</span>}
      </div>
    </div>
  );
}
