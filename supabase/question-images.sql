-- ============================================================
-- Question images: attach images to MCQ / theory questions
-- Run after wallet-subscriptions-and-status.sql
-- ============================================================

-- Per-question image references. Stored as a JSONB array of strings — the
-- public storage URL of each attached image. Null / empty means no images.
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.upload_extractions
  ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.upload_extractions
  ADD COLUMN IF NOT EXISTS has_figure BOOLEAN NOT NULL DEFAULT false;

-- Public bucket for question images. Idempotent on re-run.
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Anyone can read public bucket objects; only owner / service role can write.
DO $$ BEGIN
  CREATE POLICY "question_images_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'question-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "question_images_owner_write" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'question-images'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "question_images_owner_update" ON storage.objects
    FOR UPDATE USING (
      bucket_id = 'question-images'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "question_images_owner_delete" ON storage.objects
    FOR DELETE USING (
      bucket_id = 'question-images'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
