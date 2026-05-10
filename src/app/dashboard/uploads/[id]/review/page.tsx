'use client';

import { useEffect, useMemo, useState, useCallback, useRef, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon, ArrowRightIcon, AlertTriangleIcon, CheckIcon, PlusIcon, SparklesIcon, TrashIcon,
} from '@/components/icons';
import ImageUploader from '@/components/ImageUploader';
import { Brand } from '@/components/Logo';

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
  image_urls: string[] | null;
  has_figure: boolean | null;
  group_key: string | null;
  stem: string | null;
  part_label: string | null;
  part_position: number | null;
  updated_at?: string | null;
}

interface UploadInfo {
  id: string;
  user_id: string;
  course_id: string;
  processing_stage: string | null;
  processing_error: string | null;
  needs_review: boolean;
}

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

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
      const list: Extraction[] = (json.data?.extractions ?? []).map((e: Extraction) => ({
        ...e,
        image_urls: Array.isArray(e.image_urls) ? e.image_urls : [],
      }));
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function patchLocal(extId: string, patch: Partial<Extraction>) {
    setItems((prev) => prev.map((e) => (e.id === extId ? { ...e, ...patch } : e)));
  }

  async function persist(extId: string, patch: Partial<Extraction>) {
    const res = await fetch(`/api/uploads/${id}/extractions/${extId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (res.ok) patchLocal(extId, json.data);
    return res.ok;
  }

  async function deleteExt(extId: string) {
    const res = await fetch(`/api/uploads/${id}/extractions/${extId}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((e) => e.id !== extId));
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
      // Scroll to top + refresh data so the user sees the new state.
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await load();
    } finally {
      setConfirming(false);
    }
  }

  // -------- regrouping --------
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupStem, setGroupStem] = useState('');
  const [regrouping, setRegrouping] = useState(false);

  function toggleSelect(extId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(extId)) next.delete(extId); else next.add(extId);
      return next;
    });
  }

  async function regroupSelected() {
    const ids = Array.from(selected);
    if (ids.length < 2 || !groupStem.trim()) return;
    setRegrouping(true);
    try {
      // Preserve document order so part_position lines up with the page.
      const ordered = items.filter((e) => selected.has(e.id)).map((e) => e.id);
      const res = await fetch(`/api/uploads/${id}/extractions/regroup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'group', ids: ordered, stem: groupStem.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not group'); return; }
      setSelected(new Set());
      setGroupModalOpen(false);
      setGroupStem('');
      await load();
    } finally {
      setRegrouping(false);
    }
  }

  async function detachFromGroup(extId: string) {
    const res = await fetch(`/api/uploads/${id}/extractions/regroup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'detach', id: extId }),
    });
    if (res.ok) await load();
  }

  async function updateStem(groupKey: string, stem: string) {
    const res = await fetch(`/api/uploads/${id}/extractions/regroup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_stem', group_key: groupKey, stem }),
    });
    if (res.ok) await load();
  }

  const willPublish = items.filter((e) => !e.excluded && !e.is_duplicate && !e.confirmed).length;
  const dupCount = items.filter((e) => e.is_duplicate).length;
  const exclCount = items.filter((e) => e.excluded).length;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/dashboard/uploads" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
            <ArrowLeftIcon size={14} /> Uploads
          </Link>
          <Brand size="sm" href="/dashboard" />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Review extracted questions</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Edit anything you need to fix, attach images for any figure-based questions,
            and delete the ones you don&apos;t want to submit. Duplicates of existing
            questions are skipped automatically. Submitted questions go to admin review before
            appearing in the question bank.
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {done && (
          <div className="mb-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm px-4 py-3 rounded-lg">
            Submitted {done.published} question{done.published === 1 ? '' : 's'} for admin review.
            {done.skipped ? ` ${done.skipped} skipped.` : ''} You&apos;ll be notified once they&apos;re approved.{' '}
            <Link href="/dashboard/contributions" className="underline font-medium inline-flex items-center gap-1">View your contributions <ArrowRightIcon size={12} /></Link>
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

            {/* Group / regroup toolbar */}
            <div className="sticky top-14 z-10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 mb-3 flex items-center gap-3 flex-wrap text-xs">
              <span className="text-zinc-700 dark:text-zinc-200">
                <span className="font-semibold">{selected.size}</span> selected
              </span>
              <span className="text-zinc-400 hidden sm:inline">·</span>
              <span className="text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                Tick rows that share a heading, then group them under one stem.
              </span>
              <button
                disabled={selected.size < 2}
                onClick={() => { setGroupStem(''); setGroupModalOpen(true); }}
                className="ml-auto px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg"
              >
                Group {selected.size >= 2 ? `${selected.size} ` : ''}as multi-part
              </button>
              {selected.size > 0 && (
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="space-y-3">
              {items.map((e, idx) => {
                const prev = idx > 0 ? items[idx - 1] : null;
                // Show the shared stem once, above the first part of each group.
                const startsGroup = !!e.group_key && (!prev || prev.group_key !== e.group_key);
                return (
                  <div key={e.id}>
                    {startsGroup && e.group_key && (
                      <StemHeader
                        groupKey={e.group_key}
                        stem={e.stem ?? ''}
                        onSave={(text) => updateStem(e.group_key!, text)}
                      />
                    )}
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(e.id)}
                        onChange={() => toggleSelect(e.id)}
                        className="mt-5 ml-1 accent-amber-600 shrink-0"
                        title="Select to group with other rows"
                      />
                      <div className="flex-1 min-w-0">
                        <ExtractionCard
                          index={idx + 1}
                          ext={e}
                          onPersist={(p) => persist(e.id, p)}
                          onDelete={() => deleteExt(e.id)}
                          onDetach={e.group_key ? () => detachFromGroup(e.id) : undefined}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
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

      {groupModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-1">
              Group {selected.size} questions under one stem
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              Type the shared heading / stem the parts belong to. Each selected row becomes a sub-part
              labelled a, b, c… in the order they appear on this page.
            </p>
            <textarea
              autoFocus
              rows={4}
              value={groupStem}
              onChange={(e) => setGroupStem(e.target.value)}
              placeholder="e.g. Given the model ABC..."
              className="w-full px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setGroupModalOpen(false); setGroupStem(''); }}
                className="flex-1 px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                disabled={regrouping || !groupStem.trim() || selected.size < 2}
                onClick={regroupSelected}
                className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg"
              >
                {regrouping ? 'Grouping…' : 'Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Publish {willPublish} question{willPublish === 1 ? '' : 's'}?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
              These will be sent to admins for review. You&apos;ll be notified as each one is approved or rejected. You can&apos;t submit this batch again from this page.
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

function StemHeader({
  groupKey,
  stem,
  onSave,
}: {
  groupKey: string;
  stem: string;
  onSave: (text: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stem);
  useEffect(() => { setDraft(stem); }, [stem]);

  return (
    <div className="rounded-t-xl border border-b-0 border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Shared heading · group {groupKey.slice(0, 6)}
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline"
        >
          {editing ? 'Cancel' : 'Edit stem'}
        </button>
      </div>
      {editing ? (
        <>
          <textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-amber-300 dark:border-amber-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={async () => { await onSave(draft.trim()); setEditing(false); }}
              disabled={!draft.trim()}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-medium rounded-md"
            >
              Save stem
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
          {stem || <span className="italic text-zinc-400">No stem text — click &ldquo;Edit stem&rdquo; to add one.</span>}
        </p>
      )}
    </div>
  );
}

interface CardProps {
  index: number;
  ext: Extraction;
  onPersist: (p: Partial<Extraction>) => Promise<boolean>;
  onDelete: () => void;
  onDetach?: () => void;
}

// One card holds all of its own draft state and only persists when the user
// blurs / clicks save. Avoids the "everything autosaves separately" jank.
function ExtractionCard({ index, ext, onPersist, onDelete, onDetach }: CardProps) {
  const [questionText, setQuestionText] = useState(ext.question_text);
  const [questionType, setQuestionType] = useState<'mcq' | 'theory'>(ext.question_type);
  const [optionsList, setOptionsList] = useState<{ key: string; value: string }[]>(
    ext.options
      ? Object.entries(ext.options)
          .map(([k, v]) => ({ key: k, value: String(v) }))
          .sort((a, b) => a.key.localeCompare(b.key))
      : ensureSeed(),
  );
  const [correctAnswer, setCorrectAnswer] = useState(ext.correct_answer ?? '');
  const [year, setYear] = useState<number | ''>(ext.year ?? '');
  const [imageUrls, setImageUrls] = useState<string[]>(Array.isArray(ext.image_urls) ? ext.image_urls : []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const currentSnapshot = useMemo(
    () => JSON.stringify({ questionText, questionType, optionsList, correctAnswer, year, imageUrls }),
    [questionText, questionType, optionsList, correctAnswer, year, imageUrls],
  );
  const lastSavedSnapshotRef = useRef(currentSnapshot);
  const dirty = currentSnapshot !== lastSavedSnapshotRef.current;

  // When the parent updates ext (e.g. after a server-side save round-trip),
  // re-sync if we don't have unsaved local edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (dirty) return;
    setQuestionText(ext.question_text);
    setQuestionType(ext.question_type);
    setOptionsList(
      ext.options
        ? Object.entries(ext.options)
            .map(([k, v]) => ({ key: k, value: String(v) }))
            .sort((a, b) => a.key.localeCompare(b.key))
        : [],
    );
    setCorrectAnswer(ext.correct_answer ?? '');
    setYear(ext.year ?? '');
    setImageUrls(Array.isArray(ext.image_urls) ? ext.image_urls : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ext.id, ext.updated_at]);

  useEffect(() => {
    if (dirty && savingState === 'saved') setSavingState('idle');
  }, [dirty, savingState]);

  function ensureSeed() {
    return [
      { key: 'A', value: '' },
      { key: 'B', value: '' },
      { key: 'C', value: '' },
      { key: 'D', value: '' },
    ];
  }

  function buildOptionsObject(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const { key, value } of optionsList) {
      const trimmed = value.trim();
      if (trimmed) out[key] = trimmed;
    }
    return out;
  }

  async function save() {
    if (!dirty) return;
    setSavingState('saving');
    const patch: Partial<Extraction> = {
      question_text: questionText.trim(),
      question_type: questionType,
      options: questionType === 'mcq' ? buildOptionsObject() : null,
      correct_answer: correctAnswer.trim() || null,
      year: year === '' ? null : Number(year),
      image_urls: imageUrls,
    };
    const ok = await onPersist(patch);
    if (ok) {
      lastSavedSnapshotRef.current = currentSnapshot;
      setSavingState('saved');
      setTimeout(() => setSavingState((s) => (s === 'saved' ? 'idle' : s)), 1500);
    } else {
      setSavingState('error');
    }
  }

  async function toggleExcluded() {
    const next = !ext.excluded;
    await onPersist({ excluded: next });
  }

  function setOption(idx: number, key: 'key' | 'value', value: string) {
    setOptionsList((arr) => arr.map((o, i) => (i === idx ? { ...o, [key]: value } : o)));
  }

  function addOption() {
    if (optionsList.length >= OPTION_KEYS.length) return;
    const used = new Set(optionsList.map((o) => o.key));
    const nextKey = OPTION_KEYS.find((k) => !used.has(k)) ?? 'X';
    setOptionsList((arr) => [...arr, { key: nextKey, value: '' }]);
  }

  function removeOption(idx: number) {
    setOptionsList((arr) => {
      const next = arr.filter((_, i) => i !== idx);
      // If the removed option was the marked correct answer, clear it.
      const removedKey = arr[idx]?.key;
      if (removedKey && correctAnswer === removedKey) setCorrectAnswer('');
      return next;
    });
  }

  const willPublish = !ext.excluded && !ext.is_duplicate;
  const showFigureNudge = !!ext.has_figure && imageUrls.length === 0;

  return (
    <div
      className={`bg-white dark:bg-zinc-900 border rounded-xl p-5 ${
        ext.excluded
          ? 'border-zinc-200 dark:border-zinc-800 opacity-50'
          : ext.is_duplicate
          ? 'border-amber-200 dark:border-amber-900'
          : 'border-zinc-200 dark:border-zinc-800'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">#{index}</span>
          {ext.part_label && (
            <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              Part {ext.part_label}
            </span>
          )}
          {onDetach && (
            <button
              type="button"
              onClick={onDetach}
              className="text-[10px] text-amber-700 dark:text-amber-400 hover:underline"
              title="Detach this row from its group"
            >
              Detach
            </button>
          )}
          <select
            value={questionType}
            onChange={(e) => setQuestionType(e.target.value as 'mcq' | 'theory')}
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
        <div className="flex items-center gap-3 text-xs">
          {savingState === 'saving' && <span className="text-zinc-400">Saving…</span>}
          {savingState === 'saved' && <span className="text-green-600 dark:text-green-400 inline-flex items-center gap-1"><CheckIcon size={12} /> Saved</span>}
          {savingState === 'error' && <span className="text-red-600 dark:text-red-400">Save failed</span>}
          <button onClick={toggleExcluded} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
            {ext.excluded ? 'Include' : 'Exclude'}
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-red-500 hover:text-red-700 inline-flex items-center gap-1"
            title="Delete this draft permanently"
          >
            <TrashIcon size={12} /> Delete
          </button>
        </div>
      </div>

      {showFigureNudge && (
        <div className="mb-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs px-3 py-2 rounded-lg inline-flex items-center gap-2">
          <AlertTriangleIcon size={12} />
          This question references a figure or diagram. Attach an image so students can answer it.
        </div>
      )}

      <textarea
        value={questionText}
        onChange={(e) => setQuestionText(e.target.value)}
        rows={Math.max(2, questionText.split('\n').length)}
        className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />

      {questionType === 'theory' && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Reference answer (optional — used by the AI grader)
          </label>
          <textarea
            value={correctAnswer}
            onChange={(e) => setCorrectAnswer(e.target.value)}
            rows={4}
            placeholder="Write the model answer or marking guide. Leave blank if you only have the question."
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      )}

      {questionType === 'mcq' && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Options</span>
            <button
              type="button"
              onClick={addOption}
              disabled={optionsList.length >= OPTION_KEYS.length}
              className="text-xs text-green-600 hover:text-green-700 inline-flex items-center gap-1 disabled:opacity-40"
            >
              <PlusIcon size={12} /> Add option
            </button>
          </div>
          {optionsList.length === 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">No options yet — click <span className="font-medium">Add option</span> to start.</p>
          )}
          {optionsList.map((o, idx) => {
            const picked = correctAnswer === o.key;
            return (
              <div key={`${o.key}-${idx}`} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrectAnswer(picked ? '' : o.key)}
                  title={picked ? 'Marked correct' : 'Mark as correct'}
                  className={`shrink-0 w-7 h-7 rounded-md text-xs font-semibold border ${
                    picked
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {picked ? <CheckIcon size={12} /> : o.key}
                </button>
                <input
                  value={o.value}
                  onChange={(e) => setOption(idx, 'value', e.target.value)}
                  placeholder={`Option ${o.key}`}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="button"
                  onClick={() => removeOption(idx)}
                  className="text-zinc-400 hover:text-red-600"
                  title="Remove option"
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3">
        <ImageUploader
          value={imageUrls}
          onChange={setImageUrls}
          label="Attached images"
          hint={ext.has_figure
            ? 'This question references a figure — attach the image so students can answer.'
            : 'Add a diagram or chart if needed.'}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <label className="text-zinc-500 dark:text-zinc-400">
          Year{' '}
          <input
            type="number"
            min={1990}
            max={new Date().getFullYear()}
            value={year}
            onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
            className="ml-1 w-24 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={savingState === 'saving' || !dirty}
          className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium inline-flex items-center gap-1"
        >
          <SparklesIcon size={12} className="opacity-80" />
          {savingState === 'saving' ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
        </button>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-sm p-5">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">Delete this draft?</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              This question will be removed from the review batch. It won&apos;t reach the question bank.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={() => { setConfirmDelete(false); onDelete(); }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium py-2 rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
