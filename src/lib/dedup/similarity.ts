// ============================================================
// Deduplication — text hashing + trigram similarity
// ============================================================

import { normalizeText, hashQuestionText } from '@/lib/utils/hash';
import { createAdminClient } from '@/lib/supabase/admin';

export function trigramSimilarity(a: string, b: string): number {
  const trigrams = (s: string): Set<string> => {
    const padded = `  ${s}  `;
    const set = new Set<string>();
    for (let i = 0; i < padded.length - 2; i++) {
      set.add(padded.substring(i, i + 3));
    }
    return set;
  };

  const setA = trigrams(normalizeText(a));
  const setB = trigrams(normalizeText(b));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

// Detect and store duplicate pairs for a newly added question
export async function detectDuplicates(
  newQuestionId: string,
  newQuestionText: string,
  courseId: string,
  threshold = 0.8,
): Promise<void> {
  const supabase = createAdminClient();

  const { data: candidates } = await supabase
    .from('questions')
    .select('id, question_text')
    .eq('course_id', courseId)
    .eq('is_deleted', false)
    .neq('id', newQuestionId)
    .limit(500);

  if (!candidates?.length) return;

  const pairs: {
    question_id_a: string;
    question_id_b: string;
    similarity_score: number;
  }[] = [];

  for (const candidate of candidates) {
    const score = trigramSimilarity(newQuestionText, candidate.question_text);
    if (score >= threshold) {
      // canonical ordering to avoid duplicates
      const [a, b] =
        newQuestionId < candidate.id
          ? [newQuestionId, candidate.id]
          : [candidate.id, newQuestionId];
      pairs.push({ question_id_a: a, question_id_b: b, similarity_score: score });
    }
  }

  if (pairs.length) {
    await supabase
      .from('question_duplicates')
      .upsert(pairs, { onConflict: 'question_id_a,question_id_b', ignoreDuplicates: true });
  }
}

export async function mergeQuestions(
  keepId: string,
  removeId: string,
): Promise<void> {
  const supabase = createAdminClient();

  // Re-attribute contributions from removed question to kept question
  await supabase
    .from('question_contributions')
    .update({ question_id: keepId })
    .eq('question_id', removeId);

  // Soft-delete the duplicate
  await supabase
    .from('questions')
    .update({ is_deleted: true })
    .eq('id', removeId);

  // Mark duplicate pair as resolved
  await supabase
    .from('question_duplicates')
    .update({ resolved: true, kept_question_id: keepId })
    .or(`question_id_a.eq.${keepId},question_id_b.eq.${keepId}`)
    .or(`question_id_a.eq.${removeId},question_id_b.eq.${removeId}`);
}

export { hashQuestionText };
