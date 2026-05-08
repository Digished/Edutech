-- ============================================================
-- Upload progress tracking + question type (mcq vs theory)
-- ============================================================

ALTER TABLE public.uploads
  ADD COLUMN IF NOT EXISTS progress          INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS processing_stage  TEXT;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'mcq'
    CHECK (question_type IN ('mcq', 'theory'));

CREATE INDEX IF NOT EXISTS idx_questions_type ON public.questions(question_type);
