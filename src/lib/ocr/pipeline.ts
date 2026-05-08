// ============================================================
// Upload Processing Pipeline
// storage → OCR → question extraction → contribution logging
// Persists progress (0–100) and stage to the uploads row.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import {
  extractQuestionsFromImageUrl,
  extractQuestionsFromPdfBuffer,
  ExtractionResult,
} from './processor';
import { hashQuestionText } from '@/lib/utils/hash';
import { detectDuplicates } from '@/lib/dedup/similarity';
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
    if ((upload.file_type as FileType) === 'image') {
      // Hand the signed URL straight to OpenAI — no base64 round-trip.
      extractionResult = await extractQuestionsFromImageUrl(signed.signedUrl);
    } else {
      // GPT-4o needs PDFs via the Files API; download once, upload to OpenAI.
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

    await setProgress(supabase, uploadId, 70, 'Saving questions');

    let questionsExtracted = 0;
    const total = extractionResult.questions.length || 1;

    for (let i = 0; i < extractionResult.questions.length; i++) {
      const eq = extractionResult.questions[i];
      if (!eq.question_text?.trim()) continue;

      const content_hash = hashQuestionText(eq.question_text);

      const { data: question, error: qError } = await supabase
        .from('questions')
        .insert({
          course_id: upload.course_id,
          question_text: eq.question_text,
          question_type: eq.question_type,
          options: eq.options ?? null,
          correct_answer: eq.correct_answer ?? null,
          year: eq.year ?? null,
          source_type: 'extracted',
          // Auto-approve so questions appear in the public bank immediately;
          // admins can still soft-delete or reject from /admin/questions.
          status: 'approved',
          content_hash,
        })
        .select()
        .single();

      if (qError || !question) continue;

      await supabase.from('question_contributions').insert({
        question_id: question.id,
        user_id: upload.user_id,
        contribution_type: 'extraction',
        contribution_weight: 1.0,
      });

      detectDuplicates(question.id, eq.question_text, upload.course_id).catch(() => null);
      questionsExtracted++;

      const pct = 70 + Math.floor((25 * (i + 1)) / total);
      await setProgress(supabase, uploadId, pct, `Saved ${questionsExtracted}/${total} questions`);
    }

    await supabase
      .from('uploads')
      .update({
        processed: true,
        questions_extracted: questionsExtracted,
        progress: 100,
        processing_stage: 'Completed',
      })
      .eq('id', uploadId);

    await supabase.from('notifications').insert({
      user_id: upload.user_id,
      title: 'Upload Processed',
      body: `Your upload has been processed. ${questionsExtracted} questions were extracted and are pending review.`,
      type: 'upload',
      metadata: { upload_id: uploadId, questions_extracted: questionsExtracted },
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
