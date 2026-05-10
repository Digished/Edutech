'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, CheckIcon, FlagIcon, PinIcon, XIcon, ChevronUpIcon } from '@/components/icons';
import { Brand } from '@/components/Logo';

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
  courses: { name: string; school: string; faculty: string | null; department: string; code: string | null } | null;
  question_analytics: { views_count: number }[];
}

interface Attempt {
  id: string;
  answer: string;
  is_correct: boolean | null;
  updated_at: string;
  ai_score?: number | null;
  ai_feedback?: string | null;
}

interface Comment {
  id: string;
  body: string;
  is_anonymous: boolean;
  pinned: boolean;
  upvote_count: number;
  has_upvoted: boolean;
  can_pin: boolean;
  author: string;
  is_mine: boolean;
  created_at: string;
}

function sortComments(list: Comment[]): Comment[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.upvote_count !== b.upvote_count) return b.upvote_count - a.upvote_count;
    return a.created_at.localeCompare(b.created_at);
  });
}

export default function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [question, setQuestion] = useState<Question | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const [pickedOption, setPickedOption] = useState('');
  const [theoryAnswer, setTheoryAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [answerError, setAnswerError] = useState('');

  const [commentBody, setCommentBody] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [posting, setPosting] = useState(false);

  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState<string>('incorrect_answer');
  const [flagDetails, setFlagDetails] = useState('');
  const [flagging, setFlagging] = useState(false);
  const [flagDone, setFlagDone] = useState(false);
  const [flagError, setFlagError] = useState('');

  const [explanation, setExplanation] = useState<string | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanationError, setExplanationError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await fetch('/api/auth/me');
      if (meRes.status === 401) { window.location.href = `/login?next=/questions/${id}`; return; }

      const [qRes, aRes, cRes, eRes] = await Promise.all([
        fetch(`/api/questions/${id}`),
        fetch(`/api/questions/${id}/attempt`),
        fetch(`/api/questions/${id}/comments?limit=100`),
        fetch(`/api/questions/${id}/explain`),
      ]);
      const qJson = await qRes.json();
      const aJson = await aRes.json();
      const cJson = await cRes.json();
      if (eRes.ok) {
        const eJson = await eRes.json();
        if (eJson.data?.explanation) setExplanation(eJson.data.explanation as string);
      }
      setQuestion(qJson.data ?? null);
      const a: Attempt | null = aJson.data ?? null;
      setAttempt(a);
      if (a) {
        if (qJson.data?.question_type === 'mcq') setPickedOption(a.answer);
        else setTheoryAnswer(a.answer);
      }
      setComments(sortComments(cJson.data ?? []));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function submitAnswer() {
    setAnswerError('');
    const answer = question?.question_type === 'mcq' ? pickedOption : theoryAnswer;
    if (!answer.trim()) { setAnswerError('Please write or select an answer.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/questions/${id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      });
      const json = await res.json();
      if (!res.ok) { setAnswerError(json.error ?? 'Could not save'); return; }
      setAttempt(json.data);
    } finally {
      setSubmitting(false);
    }
  }

  async function loadExplanation() {
    if (explanationLoading) return;
    setExplanationLoading(true);
    setExplanationError('');
    try {
      const res = await fetch(`/api/questions/${id}/explain`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setExplanationError(json.error ?? 'Could not load the explanation');
        return;
      }
      setExplanation(json.data?.explanation ?? null);
    } catch {
      setExplanationError('Network error');
    } finally {
      setExplanationLoading(false);
    }
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/questions/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentBody, is_anonymous: anonymous }),
      });
      const json = await res.json();
      if (res.ok) {
        setComments((prev) => sortComments([...prev, json.data]));
        setCommentBody('');
      }
    } finally {
      setPosting(false);
    }
  }

  async function submitFlag() {
    setFlagError('');
    setFlagging(true);
    try {
      const res = await fetch(`/api/questions/${id}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: flagReason, details: flagDetails || undefined }),
      });
      const json = await res.json();
      if (!res.ok) { setFlagError(json.error ?? 'Could not submit flag'); return; }
      setFlagDone(true);
      setFlagDetails('');
      setTimeout(() => { setFlagOpen(false); setFlagDone(false); }, 1200);
    } finally {
      setFlagging(false);
    }
  }

  async function toggleUpvote(commentId: string) {
    setComments((prev) => sortComments(prev.map((c) => c.id === commentId ? {
      ...c,
      has_upvoted: !c.has_upvoted,
      upvote_count: c.upvote_count + (c.has_upvoted ? -1 : 1),
    } : c)));
    const res = await fetch(`/api/questions/${id}/comments/${commentId}/upvote`, { method: 'POST' });
    if (!res.ok) {
      // Revert on error.
      setComments((prev) => sortComments(prev.map((c) => c.id === commentId ? {
        ...c,
        has_upvoted: !c.has_upvoted,
        upvote_count: c.upvote_count + (c.has_upvoted ? -1 : 1),
      } : c)));
      return;
    }
    const json = await res.json();
    if (json.data) {
      setComments((prev) => sortComments(prev.map((c) => c.id === commentId ? {
        ...c,
        has_upvoted: json.data.upvoted,
        upvote_count: json.data.upvote_count,
      } : c)));
    }
  }

  async function togglePin(commentId: string, currentlyPinned: boolean) {
    setComments((prev) => sortComments(prev.map((c) => c.id === commentId ? { ...c, pinned: !currentlyPinned } : c)));
    const res = await fetch(`/api/questions/${id}/comments/${commentId}/pin`, { method: 'POST' });
    if (!res.ok) {
      setComments((prev) => sortComments(prev.map((c) => c.id === commentId ? { ...c, pinned: currentlyPinned } : c)));
    }
  }

  async function deleteComment(commentId: string) {
    if (!confirm('Delete this comment?')) return;
    const res = await fetch(`/api/questions/${id}/comments/${commentId}`, { method: 'DELETE' });
    if (res.ok) setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center text-sm text-zinc-400">
        Loading…
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center text-sm text-zinc-400">
        Question not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-100 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/questions" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
            <ArrowLeftIcon size={14} /> Question bank
          </Link>
          <Brand size="sm" href="/dashboard" />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center justify-end mb-2 gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setFlagOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 hover:underline"
            >
              <FlagIcon size={12} /> Flag this question
            </button>
          </div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${
              question.question_type === 'theory'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
            }`}>
              {question.question_type === 'theory' ? 'Theory' : 'MCQ'}
            </span>
            {question.courses && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {question.courses.name}{question.courses.code ? ` (${question.courses.code})` : ''} · {question.courses.school}
              </span>
            )}
            {question.year && <span className="text-xs text-zinc-400">· {question.year}</span>}
            {question.level && <span className="text-xs text-zinc-400">· {question.level} level</span>}
            {question.semester && <span className="text-xs text-zinc-400">· Sem {question.semester}</span>}
          </div>

          <p className="text-zinc-900 dark:text-white leading-relaxed font-medium whitespace-pre-line">
            {question.question_text}
          </p>

          {Array.isArray(question.image_urls) && question.image_urls.length > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {question.image_urls.map((url, i) => (
                <a
                  key={`${url}-${i}`}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 hover:opacity-90"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-auto max-h-72 object-contain" />
                </a>
              ))}
            </div>
          )}

          {/* Answer area */}
          <div className="mt-5 pt-5 border-t border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">Your answer</h2>

            {question.question_type === 'mcq' && question.options ? (
              <div className="space-y-2">
                {Object.entries(question.options).map(([k, v]) => {
                  const picked = pickedOption === k;
                  const submitted = attempt?.answer === k;
                  const isCorrect = attempt?.is_correct === true && submitted;
                  const isWrong = attempt?.is_correct === false && submitted;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setPickedOption(k)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                        isCorrect
                          ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
                          : isWrong
                          ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400'
                          : picked
                          ? 'border-green-400 bg-green-50/50 text-zinc-900 dark:border-green-700 dark:bg-green-950/40 dark:text-white'
                          : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className="font-semibold mr-2">{k}.</span>
                      {v}
                    </button>
                  );
                })}
              </div>
            ) : (
              <textarea
                value={theoryAnswer}
                onChange={(e) => setTheoryAnswer(e.target.value)}
                placeholder="Write your answer here. The community can see and discuss it via comments."
                rows={6}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            )}

            {answerError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{answerError}</p>}

            {attempt && question.question_type === 'theory' && attempt.ai_feedback && (
              <div className="mt-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300">
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">Feedback: </span>
                {attempt.ai_feedback}
              </div>
            )}

            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={submitAnswer}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
              >
                {submitting ? 'Saving…' : attempt ? 'Update answer' : 'Submit answer'}
              </button>
              {attempt && question.question_type === 'mcq' && attempt.is_correct !== null && (
                <span className={`text-xs font-medium ${attempt.is_correct ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  <span className="inline-flex items-center gap-1">
                    {attempt.is_correct ? <><CheckIcon size={14} /> Correct</> : <><XIcon size={14} /> Incorrect{question.correct_answer ? ` — correct answer is ${question.correct_answer}` : ''}</>}
                  </span>
                </span>
              )}
              {attempt && question.question_type === 'theory' && typeof attempt.ai_score === 'number' && (
                <span
                  className={`text-xs font-semibold inline-flex items-center gap-1 ${
                    attempt.ai_score >= 0.6
                      ? 'text-green-700 dark:text-green-400'
                      : attempt.ai_score >= 0.3
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  Score {Math.round(attempt.ai_score * 100)}%
                </span>
              )}
              {attempt && question.question_type === 'theory' && attempt.ai_score == null && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Saved</span>
              )}
            </div>
          </div>

          {/* Explanation panel — appears once the user has submitted an answer
              so the explanation never spoils the question. */}
          {attempt && (
            <div className="mt-5 pt-5 border-t border-zinc-100 dark:border-zinc-800">
              <ExplanationPanel
                explanation={explanation}
                loading={explanationLoading}
                error={explanationError}
                onLoad={loadExplanation}
                onClose={() => { /* keep visible */ }}
              />
            </div>
          )}
        </div>

        {/* Comments */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">
            Answers & discussion ({comments.length})
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
            Upvote answers you find helpful. Pinned answers appear at the top.
          </p>

          {comments.length === 0 ? (
            <p className="text-sm text-zinc-400">Be the first to share an explanation or alternative answer.</p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className={`flex gap-3 rounded-lg px-4 py-3 border ${
                    c.pinned
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
                      : 'bg-zinc-50 dark:bg-zinc-800/50 border-transparent'
                  }`}
                >
                  <button
                    onClick={() => toggleUpvote(c.id)}
                    aria-label={c.has_upvoted ? 'Remove upvote' : 'Upvote answer'}
                    className={`flex flex-col items-center justify-start shrink-0 w-10 rounded-md py-1 text-xs font-semibold transition-colors ${
                      c.has_upvoted
                        ? 'bg-green-600 text-white'
                        : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-green-300'
                    }`}
                  >
                    <ChevronUpIcon size={14} />
                    <span className="mt-0.5">{c.upvote_count}</span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{c.author}</span>
                        {c.pinned && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                            <PinIcon size={10} /> Pinned
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-400">{new Date(c.created_at).toLocaleString()}</span>
                        {c.can_pin && (
                          <button
                            onClick={() => togglePin(c.id, c.pinned)}
                            className="text-xs text-amber-700 dark:text-amber-400 hover:underline"
                          >
                            {c.pinned ? 'Unpin' : 'Pin'}
                          </button>
                        )}
                        {c.is_mine && (
                          <button onClick={() => deleteComment(c.id)} className="text-xs text-zinc-400 hover:text-red-600">
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-line">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={postComment} className="mt-5 pt-5 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Share your working, an alternative answer, or a correction…"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                  className="rounded"
                />
                Post anonymously
              </label>
              <button
                type="submit"
                disabled={posting || !commentBody.trim()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
              >
                {posting ? 'Posting…' : 'Post comment'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {flagOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6">
            <h2 className="font-semibold text-zinc-900 dark:text-white mb-2">Flag this question</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Tell us what&apos;s wrong. Admins review every flag.
            </p>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Reason</label>
            <select
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              className="w-full mb-3 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="incorrect_answer">Incorrect answer</option>
              <option value="duplicate">Duplicate of another question</option>
              <option value="offensive">Offensive content</option>
              <option value="wrong_course">Wrong course / category</option>
              <option value="typo">Typo or formatting</option>
              <option value="other">Other</option>
            </select>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Details (optional)</label>
            <textarea
              value={flagDetails}
              onChange={(e) => setFlagDetails(e.target.value)}
              rows={3}
              placeholder="Add any extra context that helps an admin review."
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {flagError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{flagError}</p>}
            {flagDone && <p className="mt-2 text-xs text-green-700 dark:text-green-400">Thanks — your flag was submitted.</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setFlagOpen(false); setFlagError(''); setFlagDone(false); }}
                className="flex-1 px-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                Close
              </button>
              <button onClick={submitFlag}
                disabled={flagging || flagDone}
                className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg">
                {flagging ? 'Submitting…' : flagDone ? 'Submitted' : 'Submit flag'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExplanationPanel({
  explanation,
  loading,
  error,
  onLoad,
}: {
  explanation: string | null;
  loading: boolean;
  error: string;
  onLoad: () => void;
  onClose: () => void;
}) {
  if (!explanation) {
    return (
      <div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Stuck on the answer?</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Get a step-by-step walkthrough in plain English.
            </p>
          </div>
          <button
            onClick={onLoad}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-green-300 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 disabled:opacity-60"
          >
            {loading ? 'Preparing the explanation…' : 'Explain the answer'}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Explanation</h3>
      </div>
      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed whitespace-pre-line">
        {explanation}
      </div>
    </div>
  );
}
