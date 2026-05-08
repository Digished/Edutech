// ============================================================
// Upload Processing Pipeline
// Orchestrates: storage → OCR → question extraction → contribution logging
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { extractQuestionsFromText, extractQuestionsFromImageUrl } from './processor';
import { hashQuestionText } from '@/lib/utils/hash';
import { detectDuplicates } from '@/lib/dedup/similarity';
import { FileType } from '@/types/database';

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
    let extractionResult;

    if ((upload.file_type as FileType) === 'image') {
      // Generate signed URL for the image
      const { data: signedUrl } = await supabase.storage
        .from('exam-uploads')
        .createSignedUrl(upload.file_url, 300);

      if (!signedUrl?.signedUrl) throw new Error('Could not generate signed URL');
      extractionResult = await extractQuestionsFromImageUrl(signedUrl.signedUrl);
    } else {
      // For PDF: download and pass text content
      // In production, integrate a PDF-to-text service (e.g., pdf-parse, Adobe PDF Extract)
      const { data: signedUrl } = await supabase.storage
        .from('exam-uploads')
        .createSignedUrl(upload.file_url, 300);

      if (!signedUrl?.signedUrl) throw new Error('Could not generate signed URL');

      // Pass the URL to the AI for extraction (GPT-4o can handle PDF content via URL)
      extractionResult = await extractQuestionsFromImageUrl(signedUrl.signedUrl);
    }

    if (extractionResult.error && extractionResult.questions.length === 0) {
      await supabase
        .from('uploads')
        .update({ processed: true, processing_error: extractionResult.error })
        .eq('id', uploadId);
      return;
    }

    let questionsExtracted = 0;

    for (const eq of extractionResult.questions) {
      if (!eq.question_text?.trim()) continue;

      const content_hash = hashQuestionText(eq.question_text);

      const { data: question, error: qError } = await supabase
        .from('questions')
        .insert({
          course_id: upload.course_id,
          question_text: eq.question_text,
          options: eq.options ?? null,
          correct_answer: eq.correct_answer ?? null,
          year: eq.year ?? null,
          source_type: 'extracted',
          status: 'pending',
          content_hash,
        })
        .select()
        .single();

      if (qError) continue;

      await supabase.from('question_contributions').insert({
        question_id: question.id,
        user_id: upload.user_id,
        contribution_type: 'extraction',
        contribution_weight: 1.0,
      });

      detectDuplicates(question.id, eq.question_text, upload.course_id).catch(() => null);
      questionsExtracted++;
    }

    await supabase
      .from('uploads')
      .update({ processed: true, questions_extracted: questionsExtracted })
      .eq('id', uploadId);

    // Notify uploader
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
      .update({ processed: true, processing_error: message })
      .eq('id', uploadId);
    throw err;
  }
}
