// ============================================================
// Upload Processing Pipeline
// storage → OCR → draft extractions (user reviews) → confirm publishes them
// Persists progress (0–100) and stage to the uploads row.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import {
  extractQuestionsFromImageUrl,
  extractQuestionsFromPdfBuffer,
  extractQuestionsFromText,
  ExtractionResult,
} from './processor';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

// Pulls plain text out of a Word file. .docx is a zip of XML, handled by
// mammoth; legacy .doc is a binary OLE format, handled by word-extractor.
async function extractWordText(
  buffer: ArrayBuffer,
  filename: string,
): Promise<string> {
  if (/\.doc$/i.test(filename)) {
    // word-extractor needs a path on disk.
    const path = join(tmpdir(), `${randomUUID()}.doc`);
    await writeFile(path, Buffer.from(buffer));
    try {
      const doc = await new WordExtractor().extract(path);
      return doc.getBody();
    } finally {
      await unlink(path).catch(() => null);
    }
  }
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  return value;
}
import { hashQuestionText } from '@/lib/utils/hash';
import { trigramSimilarity } from '@/lib/dedup/similarity';
import { FileType } from '@/types/database';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

async function setProgress(
  supabase: SupabaseAdmin,
  uploadId: string,
  progress: number,
  stage: string,
) {
  await supabase
    .from('uploads')
    .update({ progress, processing_stage: stage })
    .eq('id', uploadId);
}

async function findDuplicate(
  supabase: SupabaseAdmin,
  courseId: string,
  text: string,
  hash: string,
): Promise<string | null> {
  // 1) Exact hash match — same normalized text already in the bank.
  const { data: exact } = await supabase
    .from('questions')
    .select('id')
    .eq('course_id', courseId)
    .eq('content_hash', hash)
    .eq('is_deleted', false)
    .limit(1);
  if (exact && exact.length > 0) return exact[0].id;

  // 2) Trigram similarity ≥ 0.8 against same-course questions.
  const { data: candidates } = await supabase
    .from('questions')
    .select('id, question_text')
    .eq('course_id', courseId)
    .eq('is_deleted', false)
    .limit(500);
  if (!candidates) return null;

  for (const c of candidates) {
    if (trigramSimilarity(text, c.question_text) >= 0.85) return c.id;
  }
  return null;
}

export async function processUpload(uploadId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: upload } = await supabase
    .from('uploads')
    .select('*')
    .eq('id', uploadId)
    .single();

  if (!upload) throw new Error(`Upload ${uploadId} not found`);
  if (upload.processed) return;

  try {
    await setProgress(supabase, uploadId, 10, 'Preparing file');

    const { data: signed } = await supabase.storage
      .from('exam-uploads')
      .createSignedUrl(upload.file_url, 600);
    if (!signed?.signedUrl) throw new Error('Could not generate signed URL');

    await setProgress(supabase, uploadId, 25, 'Reading questions with AI');

    let extractionResult: ExtractionResult;
    const fileType = upload.file_type as FileType;
    if (fileType === 'image') {
      extractionResult = await extractQuestionsFromImageUrl(signed.signedUrl);
    } else if (fileType === 'docx') {
      const fileResp = await fetch(signed.signedUrl);
      if (!fileResp.ok) throw new Error(`Could not download file (HTTP ${fileResp.status})`);
      const fileBuffer = await fileResp.arrayBuffer();
      const text = await extractWordText(
        fileBuffer,
        upload.original_name ?? 'paper.docx',
      );
      if (!text.trim()) {
        extractionResult = { questions: [], error: 'Word document contained no readable text' };
      } else {
        extractionResult = await extractQuestionsFromText(text);
      }
    } else {
      const fileResp = await fetch(signed.signedUrl);
      if (!fileResp.ok) throw new Error(`Could not download file (HTTP ${fileResp.status})`);
      const fileBuffer = await fileResp.arrayBuffer();
      extractionResult = await extractQuestionsFromPdfBuffer(
        fileBuffer,
        upload.original_name ?? 'paper.pdf',
      );
    }

    if (extractionResult.error && extractionResult.questions.length === 0) {
      await supabase
        .from('uploads')
        .update({
          processed: true,
          processing_error: extractionResult.error,
          progress: 100,
          processing_stage: 'Failed',
        })
        .eq('id', uploadId);
      return;
    }

    // Clear any prior drafts for this upload (e.g. retried processing).
    await supabase.from('upload_extractions').delete().eq('upload_id', uploadId);

    await setProgress(supabase, uploadId, 70, 'Checking for duplicates');

    const total = extractionResult.questions.length || 1;
    const draftRows: {
      upload_id: string;
      position: number;
      question_text: string;
      question_type: 'mcq' | 'theory';
      options: Record<string, string> | null;
      correct_answer: string | null;
      year: number | null;
      content_hash: string;
      is_duplicate: boolean;
      duplicate_of: string | null;
      has_figure: boolean;
      group_key: string | null;
      stem: string | null;
      part_label: string | null;
      part_position: number | null;
    }[] = [];

    for (let i = 0; i < extractionResult.questions.length; i++) {
      const eq = extractionResult.questions[i];
      const text = eq.question_text?.trim();
      if (!text) continue;

      const content_hash = hashQuestionText(text);
      const dupOf = await findDuplicate(supabase, upload.course_id, text, content_hash);

      draftRows.push({
        upload_id: uploadId,
        position: i,
        question_text: text,
        question_type: eq.question_type,
        options: eq.options ?? null,
        correct_answer: eq.correct_answer ?? null,
        year: eq.year ?? null,
        content_hash,
        is_duplicate: dupOf !== null,
        duplicate_of: dupOf,
        has_figure: !!eq.has_figure,
        group_key: eq.group_key ?? null,
        stem: eq.stem ?? null,
        part_label: eq.part_label ?? null,
        part_position: eq.part_position ?? null,
      });

      const pct = 70 + Math.floor((25 * (i + 1)) / total);
      await setProgress(
        supabase,
        uploadId,
        pct,
        `Reviewing extraction ${i + 1}/${total}`,
      );
    }

    if (draftRows.length > 0) {
      await supabase.from('upload_extractions').insert(draftRows);
    }

    await supabase
      .from('uploads')
      .update({
        processed: true,
        progress: 100,
        processing_stage: 'Awaiting your review',
        needs_review: true,
      })
      .eq('id', uploadId);

    await supabase.from('notifications').insert({
      user_id: upload.user_id,
      title: 'Questions ready for review',
      body: `We extracted ${draftRows.length} question${draftRows.length === 1 ? '' : 's'} from your upload. Review and confirm to publish.`,
      type: 'upload',
      metadata: { upload_id: uploadId, extracted: draftRows.length },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed';
    await supabase
      .from('uploads')
      .update({
        processed: true,
        processing_error: message,
        progress: 100,
        processing_stage: 'Failed',
      })
      .eq('id', uploadId);
    throw err;
  }
}
